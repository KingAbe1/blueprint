import type * as TS from 'typescript';

type TsModule = typeof import('typescript');

export interface FunctionComplexityMetrics {
  structuralComplexity: number;
  logicalOperatorCount: number;
  effectiveComplexity: number;
  maxNesting: number;
  lineSpan: number;
  logicalLineCount: number;
  declarativeHeavy: boolean;
}

function measureMaxNesting(ts: TsModule, root: TS.Node): number {
  let max = 0;
  const visit = (node: TS.Node, depth: number) => {
    let next = depth;
    if (
      ts.isIfStatement(node) ||
      ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isTryStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isCatchClause(node)
    ) {
      next = depth + 1;
      max = Math.max(max, next);
    }
    ts.forEachChild(node, child => visit(child, next));
  };
  visit(root, 0);
  return max;
}

function countLogicalLines(ts: TsModule, sourceFile: TS.SourceFile, body: TS.Node): number {
  const start = body.getStart(sourceFile);
  const end = body.getEnd();
  const text = sourceFile.text.slice(start, end);
  let count = 0;
  for (const line of text.split(/\r\n|\n|\r/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed === '{' || trimmed === '}') {
      continue;
    }
    count += 1;
  }
  return Math.max(1, count);
}

function switchComplexityContribution(ts: TsModule, switchNode: TS.SwitchStatement): number {
  const clauses = switchNode.caseBlock.clauses.filter(ts.isCaseClause);
  if (clauses.length === 0) return 1;
  if (clauses.length <= 6) return clauses.length;

  const smallCases = clauses.filter(clause => {
    const statementCount = clause.statements.length;
    if (statementCount === 0) return true;
    if (statementCount > 2) return false;
    return clause.statements.every(statement => {
      if (ts.isBreakStatement(statement) || ts.isReturnStatement(statement)) return true;
      if (ts.isBlock(statement) && statement.statements.length <= 2) return true;
      return false;
    });
  });

  if (smallCases.length >= clauses.length * 0.75) {
    return 2 + Math.min(4, Math.floor(clauses.length / 4));
  }
  return clauses.length;
}

function isDeclarativeHeavy(ts: TsModule, body: TS.Node): boolean {
  if (!ts.isBlock(body)) return false;
  const statements = body.statements;
  if (statements.length < 4) return false;

  let declarativeStatements = 0;
  for (const statement of statements) {
    if (ts.isReturnStatement(statement)) {
      const expr = statement.expression;
      if (expr && (ts.isObjectLiteralExpression(expr) || ts.isArrayLiteralExpression(expr))) {
        declarativeStatements += 1;
        continue;
      }
      if (expr && ts.isCallExpression(expr)) {
        const callee = expr.expression;
        if (
          ts.isPropertyAccessExpression(callee) &&
          (callee.name.text === 'map' || callee.name.text === 'filter' || callee.name.text === 'flatMap')
        ) {
          declarativeStatements += 1;
        }
      }
    }
    if (ts.isVariableStatement(statement)) {
      const hasLiteralInit = statement.declarationList.declarations.some(
        decl =>
          decl.initializer &&
          (ts.isObjectLiteralExpression(decl.initializer) || ts.isArrayLiteralExpression(decl.initializer)),
      );
      if (hasLiteralInit) declarativeStatements += 1;
    }
  }

  return declarativeStatements / statements.length >= 0.45;
}

export function analyzeFunctionBodyComplexity(
  ts: TsModule,
  sourceFile: TS.SourceFile,
  body: TS.Node,
  isFunctionNode: (node: TS.Node) => node is TS.FunctionLikeDeclaration,
): FunctionComplexityMetrics {
  let structuralComplexity = 1;
  let logicalOperatorCount = 0;

  const visit = (node: TS.Node, currentFunction?: TS.Node) => {
    if (currentFunction && node !== currentFunction && isFunctionNode(node)) {
      ts.forEachChild(node, child => visit(child, node));
      return;
    }

    if (ts.isIfStatement(node)) {
      structuralComplexity += 1;
    } else if (
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCatchClause(node)
    ) {
      structuralComplexity += 1;
    } else if (ts.isConditionalExpression(node)) {
      structuralComplexity += 1;
    } else if (ts.isSwitchStatement(node)) {
      structuralComplexity += switchComplexityContribution(ts, node);
    } else if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      logicalOperatorCount += 1;
    }

    ts.forEachChild(node, child => visit(child, isFunctionNode(node) ? node : currentFunction));
  };

  visit(body);

  const logicalBonus = Math.min(3, Math.floor(logicalOperatorCount / 3));
  const effectiveComplexity = structuralComplexity + logicalBonus;
  const maxNesting = measureMaxNesting(ts, body);
  const logicalLineCount = countLogicalLines(ts, sourceFile, body);
  const declarativeHeavy = isDeclarativeHeavy(ts, body);

  const startLine = sourceFile.getLineAndCharacterOfPosition(body.getStart(sourceFile)).line + 1;
  const endLine = sourceFile.getLineAndCharacterOfPosition(body.getEnd()).line + 1;
  const lineSpan = endLine - startLine + 1;

  return {
    structuralComplexity,
    logicalOperatorCount,
    effectiveComplexity,
    maxNesting,
    lineSpan,
    logicalLineCount,
    declarativeHeavy,
  };
}

export function evaluateFunctionComplexityFinding(
  name: string,
  metrics: FunctionComplexityMetrics,
): {
  title: 'High-complexity function' | 'Oversized function';
  priority: 'high' | 'medium';
  detail: string;
  evidenceExtra: string;
} | null {
  const {
    effectiveComplexity,
    structuralComplexity,
    logicalOperatorCount,
    maxNesting,
    lineSpan,
    logicalLineCount,
    declarativeHeavy,
  } = metrics;

  const highComplexityThreshold = declarativeHeavy ? 16 : 14;
  const nestingAmplifier = maxNesting >= 5 ? 2 : maxNesting >= 4 ? 1 : 0;
  const complexityScore = effectiveComplexity + nestingAmplifier;

  const branchyAndLong =
    logicalLineCount >= 70 && structuralComplexity >= 9 && effectiveComplexity >= 11;
  const veryLong = logicalLineCount >= 110 || lineSpan >= 120;
  const moderatelyLongAndComplex =
    logicalLineCount >= 85 && complexityScore >= 12 && !declarativeHeavy;

  const isHighComplexity =
    complexityScore >= highComplexityThreshold ||
    (structuralComplexity >= 12 && maxNesting >= 4) ||
    effectiveComplexity >= 20;

  const isOversized =
    !isHighComplexity &&
    (veryLong || branchyAndLong || moderatelyLongAndComplex) &&
    !(declarativeHeavy && structuralComplexity <= 10 && maxNesting <= 3);

  if (!isHighComplexity && !isOversized) return null;

  const priority: 'high' | 'medium' =
    effectiveComplexity >= 22 || maxNesting >= 6 || (isHighComplexity && effectiveComplexity >= 18)
      ? 'high'
      : 'medium';

  const evidenceExtra = [
    `Structural complexity: ${structuralComplexity}`,
    `Effective score: ${effectiveComplexity}`,
    `Max nesting: ${maxNesting}`,
    `${logicalLineCount} logical lines (${lineSpan} line span)`,
    declarativeHeavy ? 'Mostly declarative/data shaping' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (isHighComplexity) {
    const logicNote =
      logicalOperatorCount > 0
        ? ` Short-circuit &&/|| add at most +3 (${logicalOperatorCount} seen); ?? is ignored.`
        : '';
    return {
      title: 'High-complexity function',
      priority,
      detail: `${name} has effective complexity ${effectiveComplexity} (structural ${structuralComplexity}, nesting ${maxNesting}).${logicNote} Nested control flow and many independent branches make this harder to test safely than a long but flat data builder.`,
      evidenceExtra,
    };
  }

  return {
    title: 'Oversized function',
    priority,
    detail: `${name} spans ${logicalLineCount} logical lines (${lineSpan} total). Effective complexity is ${effectiveComplexity}, which is moderate - consider splitting by responsibility if the function mixes formatting, I/O, and business rules.`,
    evidenceExtra,
  };
}
