import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translate } from '../i18n';
import { StatusScreen } from '../screens/StatusScreen';
import { useGame } from '../store/game';

interface State {
  error: Error | null;
}

/** Глобальный перехватчик ошибок рендера: красивый экран и перезагрузка вместо белого экрана. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI crashed', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const locale = useGame.getState().locale;
    return (
      <StatusScreen
        testId="error-boundary"
        title={translate(locale, 'error.generic.title')}
        text={translate(locale, 'error.generic.text')}
        action={{ label: translate(locale, 'common.reload'), onClick: () => window.location.reload() }}
      />
    );
  }
}
