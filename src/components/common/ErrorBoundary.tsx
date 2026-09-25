import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** 한 화면의 오류가 앱 전체를 중단시키지 않도록 격리 */
export class ErrorBoundary extends Component<{ name: string; children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.name}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <p className="text-[14px] font-medium">{this.props.name} 화면을 표시할 수 없습니다.</p>
            <p className="mt-1 text-[12px] text-muted">{this.state.error.message}</p>
            <button
              type="button"
              className="mt-3 h-9 rounded-full bg-surface-2 px-4 text-[13px] font-semibold text-fg"
              onClick={() => this.setState({ error: null })}
            >
              다시 시도
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
