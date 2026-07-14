import { Suspense } from 'react';
import AuthButton from './AuthButton';
import HeaderToggle from './HeaderToggle';
import SearchForm from './SearchForm';
import { HeaderProvider } from './HeaderProvider';

export default function Header() {
  return (
    <HeaderProvider>
      <header className="header">
        <div className="header__inner">
          <HeaderToggle />
          <Suspense fallback={null}>
            <SearchForm />
          </Suspense>

          <div className="header__actions font-bold">
            <AuthButton />
          </div>
        </div>
      </header>
    </HeaderProvider>
  );
}
