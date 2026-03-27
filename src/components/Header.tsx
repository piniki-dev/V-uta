import { createClient } from '@/utils/supabase/server';
import AuthButton from './AuthButton';
import HeaderToggle from './HeaderToggle';
import SearchForm from './SearchForm';
import { HeaderProvider } from './HeaderProvider';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <HeaderProvider>
      <header className="header">
        <div className="header__inner">
          <HeaderToggle />
          <SearchForm />

          <div className="header__actions font-bold">
            <AuthButton user={user} />
          </div>
        </div>
      </header>
    </HeaderProvider>
  );
}
