import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  disabled?: boolean;
}

export interface DropdownProps<T = string> {
  options: DropdownOption<T>[];
  value?: T;
  onChange: (value: T) => void;
  placeholder?: string;
  label?: string;
  sublabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'subtle' | 'ghost';
  align?: 'left' | 'right';
  placement?: 'bottom' | 'top' | 'auto';
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  fullWidth?: boolean;
  renderOption?: (option: DropdownOption<T>, isSelected: boolean) => React.ReactNode;
  renderTrigger?: (selectedOption?: DropdownOption<T>, isOpen?: boolean) => React.ReactNode;
}

export function Dropdown<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  label,
  sublabel,
  icon,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search options...',
  size = 'md',
  variant = 'default',
  align = 'left',
  placement = 'auto',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  fullWidth = true,
  renderOption,
  renderTrigger
}: DropdownProps<T>) {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUpward: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    openUpward: false
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  type MenuCoords = { top: number; left: number; width: number; openUpward: boolean };

  const measureMenuCoords = useCallback((): MenuCoords | null => {
    if (!dropdownRef.current) return null;
    const rect = dropdownRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenUpward =
      placement === 'top' || (placement === 'auto' && spaceBelow < 260 && spaceAbove > 200);
    const menuWidth = Math.max(rect.width, 200);
    let left = rect.left;
    if (align === 'right') {
      left = rect.right - menuWidth;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    return {
      top: shouldOpenUpward ? rect.top - 6 : rect.bottom + 6,
      left,
      width: menuWidth,
      openUpward: shouldOpenUpward,
    };
  }, [align, placement]);

  const applyMenuCoords = useCallback(() => {
    const next = measureMenuCoords();
    if (next) setCoords(next);
  }, [measureMenuCoords]);

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen(prev => {
      if (prev) return false;
      const next = measureMenuCoords();
      if (next) setCoords(next);
      return true;
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    applyMenuCoords();
  }, [isOpen, applyMenuCoords]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', applyMenuCoords);
    window.addEventListener('scroll', applyMenuCoords, true);
    return () => {
      window.removeEventListener('resize', applyMenuCoords);
      window.removeEventListener('scroll', applyMenuCoords, true);
    };
  }, [isOpen, applyMenuCoords]);

  // Close dropdown on outside click (supporting portal ref)
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen, searchable]);

  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(q) || 
      (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [options, searchable, searchQuery]);

  const handleSelect = (option: DropdownOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  // Size styling classes
  const sizeClasses = {
    sm: 'text-[11px] py-1.5 px-2.5 rounded-lg gap-1.5',
    md: 'text-xs py-2 px-3 rounded-xl gap-2',
    lg: 'text-sm py-2.5 px-3.5 rounded-xl gap-2.5'
  };

  // Variant styling classes
  const getTriggerVariantClasses = () => {
    if (disabled) {
      return isDark 
        ? 'bg-[#121316] border-[#22242B] text-slate-600 opacity-50 cursor-not-allowed'
        : 'bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed';
    }

    if (variant === 'ghost') {
      return isDark
        ? 'bg-transparent border-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white'
        : 'bg-transparent border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900';
    }

    if (variant === 'subtle') {
      return isDark
        ? 'bg-[#15161C]/70 border-[#252833] text-slate-200 hover:border-[#353948] hover:bg-[#181A22]'
        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-white hover:border-slate-300';
    }

    // Default variant
    return isDark
      ? `bg-[#131419] border-[#242630] text-white hover:border-[#363947] focus:border-blue-500 ${
          isOpen ? 'border-blue-500/80 ring-1 ring-blue-500/20' : ''
        }`
      : `bg-white border-slate-200 text-slate-900 hover:border-slate-300 focus:border-blue-500 shadow-2xs ${
          isOpen ? 'border-blue-500 ring-1 ring-blue-500/20' : ''
        }`;
  };

  const menuReady = isOpen && coords.width > 0;

  const portalMenu = menuReady && typeof document !== 'undefined' ? createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        top: coords.openUpward ? 'auto' : `${coords.top}px`,
        bottom: coords.openUpward ? `${window.innerHeight - coords.top}px` : 'auto',
        zIndex: 99999,
        transformOrigin: coords.openUpward ? 'bottom center' : 'top center',
      }}
      className={`min-w-[200px] rounded-xl border shadow-2xl backdrop-blur-2xl overflow-hidden transition-[opacity,transform] duration-100 ease-out opacity-100 ${
        isDark 
          ? 'bg-[#12141A] border-[#2A2E3D] shadow-2xl text-slate-200' 
          : 'bg-white border-slate-200 shadow-2xl text-slate-800'
      } ${menuClassName}`}
    >
      {/* Search Box if Searchable */}
      {searchable && (
        <div className={`p-2 border-b flex items-center space-x-2 ${
          isDark ? 'border-[#222530] bg-[#0F1014]/60' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full text-xs bg-transparent outline-none border-none placeholder-slate-400 font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Options List */}
      <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
        {filteredOptions.length === 0 ? (
          <div className={`text-center py-4 text-xs ${isDark ? 'text-[#717380]' : 'text-slate-400'}`}>
            No matches found
          </div>
        ) : (
          filteredOptions.map((opt) => {
            const isSelected = opt.value === value;

            if (renderOption) {
              return (
                <div
                  key={String(opt.value)}
                  onClick={() => handleSelect(opt)}
                  className="cursor-pointer"
                >
                  {renderOption(opt, isSelected)}
                </div>
              );
            }

            return (
              <button
                key={String(opt.value)}
                type="button"
                disabled={opt.disabled}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer group ${
                  opt.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : isSelected
                      ? isDark 
                        ? 'bg-blue-600/20 text-blue-400 font-semibold' 
                        : 'bg-blue-50 text-blue-700 font-semibold'
                      : isDark
                        ? 'hover:bg-white/[0.06] text-slate-200 hover:text-white'
                        : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-2 truncate min-w-0 pr-2">
                  {opt.icon && (
                    <span className={`shrink-0 ${isSelected ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-200'}`}>
                      {opt.icon}
                    </span>
                  )}
                  
                  <div className="truncate">
                    <div className="truncate font-medium flex items-center space-x-1.5">
                      <span>{opt.label}</span>
                      {opt.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    {opt.description && (
                      <div className={`text-[10px] truncate leading-tight mt-0.5 ${
                        isSelected 
                          ? isDark ? 'text-blue-300/80' : 'text-blue-600/80'
                          : isDark ? 'text-[#818390]' : 'text-slate-400'
                      }`}>
                        {opt.description}
                      </div>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-1" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'} ${className}`} ref={dropdownRef}>
      {/* Optional Label / Header */}
      {(label || sublabel) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && (
            <label className={`text-xs font-semibold flex items-center space-x-1.5 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              {icon && <span className="text-blue-500 shrink-0">{icon}</span>}
              <span>{label}</span>
            </label>
          )}
          {sublabel && (
            <span className={`text-[11px] ${isDark ? 'text-[#8E8F99]' : 'text-slate-400'}`}>
              {sublabel}
            </span>
          )}
        </div>
      )}

      {/* Trigger Button */}
      {renderTrigger ? (
        <div onClick={toggleOpen}>
          {renderTrigger(selectedOption, isOpen)}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={toggleOpen}
          className={`flex items-center justify-between w-full border font-medium transition-all cursor-pointer select-none outline-none ${
            sizeClasses[size]
          } ${getTriggerVariantClasses()} ${triggerClassName}`}
        >
          <div className="flex items-center space-x-2 truncate min-w-0">
            {selectedOption?.icon && (
              <span className="shrink-0 text-blue-500 flex items-center">{selectedOption.icon}</span>
            )}
            {!selectedOption?.icon && icon && (
              <span className="shrink-0 text-blue-500 flex items-center">{icon}</span>
            )}
            <span className={`truncate ${!selectedOption ? (isDark ? 'text-[#6A6C78]' : 'text-slate-400') : ''}`}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {selectedOption?.badge && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                {selectedOption.badge}
              </span>
            )}
          </div>

          <ChevronDown className={`w-3.5 h-3.5 text-[#7A7C88] transition-transform duration-200 shrink-0 ml-1.5 ${
            isOpen ? 'rotate-180 text-blue-500' : ''
          }`} />
        </button>
      )}

      {/* Render Portal Menu */}
      {portalMenu}
    </div>
  );
}
