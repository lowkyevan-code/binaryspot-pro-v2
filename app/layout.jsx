import './globals.css';

export const metadata = {
  title: 'BinarySpot Pro',
  description: 'BinarySpot Pro Algorithmic Trading Hub',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
