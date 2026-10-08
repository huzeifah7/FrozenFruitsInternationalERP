import ClientPage from './client';
export default function Page() {
  return <ClientPage />;
}


export function generateStaticParams() {
  return [{ customerId: '1' }];
}
