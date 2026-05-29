'use client';

import { useEffect, useRef } from 'react';
import TomSelect from 'tom-select';
import { renderAlteredText } from '@/lib/utils/alteredText';

interface Option {
  value: string;
  label: string;
}

interface SingleSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SingleSelect({ options, value, onChange, placeholder = '', className = '' }: SingleSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const tsRef = useRef<TomSelect | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => { onChangeRef.current = onChange; });

  const toTsOptions = (opts: Option[]) => opts.map((o) => ({ value: o.value, text: o.label }));

  useEffect(() => {
    if (!selectRef.current) return;
    tsRef.current = new TomSelect(selectRef.current, {
      placeholder,
      options: toTsOptions(options),
      items: value ? [value] : [],
      dropdownParent: 'body',
      allowEmptyOption: true,
      onChange(val: string) {
        onChangeRef.current(val ?? '');
      },
      render: {
        option: (data: { value: string; text: string }) =>
          `<div class="option">${renderAlteredText(data.text)} <span class="ts-altered-id">${data.value}</span></div>`,
        item: (data: { value: string; text: string }) =>
          `<div class="item">${renderAlteredText(data.text)} <span class="ts-altered-id">${data.value}</span></div>`,
      },
    });
    return () => {
      tsRef.current?.destroy();
      tsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Sync options */
  useEffect(() => {
    const ts = tsRef.current;
    if (!ts) return;
    ts.clearOptions();
    toTsOptions(options).forEach((o) => ts.addOption(o));
    ts.refreshOptions(false);
  }, [options]);

  /* Sync value */
  useEffect(() => {
    const ts = tsRef.current;
    if (!ts) return;
    const current = ts.getValue() as string;
    if (current !== value) ts.setValue(value ?? '', true);
  }, [value]);

  return <select ref={selectRef} className={className} />;
}
