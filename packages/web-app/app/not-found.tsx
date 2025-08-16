import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
            <p className="text-lg mb-8">The page you are looking for does not exist.</p>
            <Link href="/" className="text-blue-500 hover:underline">Go back to Home</Link>
        </main>
    );
}