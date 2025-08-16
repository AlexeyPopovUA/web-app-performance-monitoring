import React, {PropsWithChildren} from "react";
import clsx from "clsx";
import Head from "next/head";

export async function generateMetadata() {
  return {
    //metadataBase: new URL(environment.url),
    alternates: {
      canonical: '/'
    }
  }
}

const NODE_ENV = process.env.NODE_ENV;

export default function RootLayout({children}: PropsWithChildren) {
  return (
    <html lang="en">
    <body className={clsx("relative")}>
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
