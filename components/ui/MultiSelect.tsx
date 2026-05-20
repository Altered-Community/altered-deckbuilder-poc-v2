'use client';

import { useEffect, useRef } from 'react';
import TomSelect from 'tom-select';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function MultiSelect({ options, value, onChange, placeholder = '', className = '' }: MultiSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const tsRef = useRef<TomSelect | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const toTsOptions = (opts: Option[]) => opts.map((o) => ({ value: o.value, text: o.label }));

  useEffect(() => {
    if (!selectRef.current) return;
    tsRef.current = new TomSelect(selectRef.current, {
      plugins: ['remove_button'],
      placeholder,
      options: toTsOptions(options),
      items: value,
      onItemAdd() { tsRef.current?.blur(); },
      onChange(vals: string | string[]) {
        const arr = Array.isArray(vals) ? vals : (vals ? [vals] : []);
        onChangeRef.current(arr);
      },
    });
    return () => {
      tsRef.current?.destroy();
      tsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Sync options quand la liste change */
  useEffect(() => {
    const ts = tsRef.current;
    if (!ts) return;
    ts.clearOptions();
    toTsOptions(options).forEach((o) => ts.addOption(o));
    ts.refreshOptions(false);
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sync value externe → TomSelect */
  useEffect(() => {
    const ts = tsRef.current;
    if (!ts) return;
    const current = ts.getValue() as string[];
    const same = current.length === value.length && value.every((v) => current.includes(v));
    if (!same) ts.setValue(value, true);
  }, [value]);

  return <select ref={selectRef} multiple className={className} />;
}
