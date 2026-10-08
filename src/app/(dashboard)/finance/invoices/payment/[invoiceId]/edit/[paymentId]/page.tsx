import ClientPage from './client';
export default function Page() {
  return <ClientPage />;
}


export function generateStaticParams() {
  return [{ invoiceId: '1', paymentId: '1' }];
}
