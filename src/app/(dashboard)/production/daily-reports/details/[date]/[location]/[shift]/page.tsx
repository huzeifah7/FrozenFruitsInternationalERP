import ClientPage from './client';
export default function Page() {
  return <ClientPage />;
}


export function generateStaticParams() {
  return [{ date: '1', location: '1', shift: '1' }];
}
