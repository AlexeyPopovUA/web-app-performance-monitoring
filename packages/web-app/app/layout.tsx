import React, {PropsWithChildren} from "react";
import clsx from "clsx";
import Head from "next/head";
import type { Metadata } from "next";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return {
    //metadataBase: new URL(environment.url),
    alternates: {
      canonical: '/'
    }
  }
}

export default function RootLayout({children}: PropsWithChildren) {
  return (
    <html lang="en">
    <body className={clsx("min-h-screen bg-gray-50 text-gray-900")}> 
    <Head>
      <title>Performance Reports Dashboard</title>
      <meta name="description" content="Web application performance monitoring dashboard"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
    </Head>
    {children}
    </body>
    </html>
  )
}