import { Link } from 'react-router-dom';
import { PlaceholderPage } from '../components/common/PlaceholderPage';

export function NotFoundPage() {
  return (
    <>
      <PlaceholderPage
        title="Page not found"
        description="The page you requested could not be found."
      />
      <Link
        to="/"
        className="mt-6 inline-block rounded text-action underline underline-offset-4"
      >
        Return to dashboard
      </Link>
    </>
  );
}
