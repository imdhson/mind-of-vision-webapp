import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger';

export function Button({
  variant = 'outline',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-9 min-w-9 select-none items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-accent-fg active:opacity-80',
        variant === 'outline' && 'border border-line bg-surface text-fg active:bg-surface-2',
        variant === 'ghost' && 'text-fg active:bg-surface-2',
        variant === 'danger' && 'border border-line bg-surface text-danger active:bg-surface-2',
        className,
      )}
      {...rest}
    />
  );
}

/** 카메라/3D 화면 위에 떠 있는 반투명 원형 버튼 (터치 영역 40px) */
export function OverlayButton({
  className,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-2.5 text-[12px] font-medium backdrop-blur-md transition-colors disabled:opacity-40',
        active ? 'bg-accent text-accent-fg' : 'bg-overlay text-fg',
        className,
      )}
      {...rest}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('flex rounded-lg bg-surface-2 p-0.5', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-8 flex-1 rounded-md px-2 text-[12px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 숫자 입력 필드: 입력 중에는 문자열로 보관하고, 유효한 숫자일 때만 onChange 로 전달합니다.
 * 빈 값은 undefined (= 보정 없음)
 */
export function NumberField({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step,
  error,
  hint,
  placeholder,
  disabled,
  id,
}: {
  label: ReactNode;
  unit: string;
  value: number | undefined;
  onChange: (v: number | undefined, raw: string) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  hint?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  // 외부에서 값이 바뀐 경우(초기화·단위 변경 등)에만 입력 문자열 동기화
  useEffect(() => {
    if (value != null && Number.isNaN(value)) return;
    setText((prev) => {
      const parsed = prev.trim() === '' ? undefined : Number(prev);
      return parsed === value ? prev : value == null ? '' : String(value);
    });
  }, [value]);
  return (
    <label className="block" htmlFor={id}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium">{label}</span>
        <span className="text-[11px] text-muted tabular">
          {min != null && max != null ? `${min}~${max} ${unit}` : unit}
        </span>
      </div>
      <div
        className={cx(
          'flex h-10 items-center rounded-lg border bg-surface px-2.5',
          error ? 'border-danger' : 'border-line focus-within:border-fg',
          disabled && 'opacity-50',
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          disabled={disabled}
          className="w-full min-w-0 bg-transparent text-[15px] outline-none tabular placeholder:text-muted/60"
          value={text}
          placeholder={placeholder}
          step={step}
          onChange={(e) => {
            const raw = e.target.value.replace(',', '.');
            setText(raw);
            if (raw.trim() === '') onChange(undefined, raw);
            else {
              const n = Number(raw);
              onChange(Number.isFinite(n) ? n : NaN, raw);
            }
          }}
        />
        <span className="ml-1 shrink-0 text-[12px] text-muted">{unit}</span>
      </div>
      {error ? (
        <div className="mt-0.5 text-[11px] text-danger">{error}</div>
      ) : hint ? (
        <div className="mt-0.5 text-[11px] text-muted">{hint}</div>
      ) : null}
    </label>
  );
}

export function Row({ k, v, sub }: { k: ReactNode; v: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[12px] text-muted">{k}</span>
      <span className="min-w-0 text-right text-[13px] tabular">
        {v}
        {sub ? <span className="ml-1 text-[11px] text-muted">{sub}</span> : null}
      </span>
    </div>
  );
}

export function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {right}
      </div>
      <div className="rounded-xl border border-line bg-surface">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'strong' | 'danger' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold',
        tone === 'default' && 'bg-surface-2 text-muted',
        tone === 'strong' && 'bg-accent text-accent-fg',
        tone === 'danger' && 'bg-surface-2 text-danger',
      )}
    >
      {children}
    </span>
  );
}
