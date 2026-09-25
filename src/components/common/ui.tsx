import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

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
        'inline-flex h-9 min-w-9 select-none items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-accent-fg shadow-sm active:opacity-85',
        variant === 'outline' && 'bg-surface-2 text-fg active:bg-line',
        variant === 'ghost' && 'text-fg active:bg-surface-2',
        variant === 'danger' && 'bg-surface-2 text-danger active:bg-line',
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
        'inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 text-[12px] font-semibold shadow-sm backdrop-blur-md transition-colors disabled:opacity-40',
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
    <div className={cx('flex rounded-full bg-surface-2 p-1', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-8 flex-1 rounded-full px-2 text-[12px] font-semibold transition-colors',
            value === o.value ? 'bg-surface text-accent shadow-sm' : 'text-muted',
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
  // 외부에서 값이 바뀐 경우(초기화·단위 변경 등)에만 입력 문자열 동기화.
  // 입력 중인 문자열이 같은 수를 뜻하면("1." → 1) 그대로 둬 커서·입력이 끊기지 않게 함
  const [prevValue, setPrevValue] = useState(value);
  if (!Object.is(value, prevValue)) {
    setPrevValue(value);
    if (value == null || !Number.isNaN(value)) {
      const parsed = text.trim() === '' ? undefined : Number(text);
      if (parsed !== value) setText(value == null ? '' : String(value));
    }
  }
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
          'flex h-11 items-center rounded-2xl bg-surface-2 px-3 ring-1 ring-inset ring-transparent transition-colors',
          error ? 'ring-danger' : 'focus-within:ring-accent',
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

/** 켜기/끄기 토글 스위치 */
export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-1">
      {label ? <span className="text-[13px] font-medium">{label}</span> : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-surface-2',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
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
      <div className="mb-2 flex items-center justify-between px-2">
        <h2 className="text-[13px] font-bold text-fg">{title}</h2>
        {right}
      </div>
      <div className="rounded-[22px] bg-surface shadow-sm">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'strong' | 'danger' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-px text-[10px] font-semibold',
        tone === 'default' && 'bg-surface-2 text-muted',
        tone === 'strong' && 'bg-accent text-accent-fg',
        tone === 'danger' && 'bg-danger/15 text-danger',
      )}
    >
      {children}
    </span>
  );
}
