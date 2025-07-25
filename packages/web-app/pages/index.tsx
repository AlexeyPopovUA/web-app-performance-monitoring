import { GetStaticProps } from 'next'
import Head from 'next/head'
import { ReportsGrid } from '../components/ReportsGrid'

type SingleReport = {
  projectName: string;
  variantName: string;
  environment: string;
  date: string;
  path: string;
}

type GroupedReports = {
  [projectName: string]: {
    [environment: string]: {
      [variantName: string]: SingleReport[];
    };
  };
}

interface HomeProps {
  reports: GroupedReports;
  lastUpdated: string;
}

export default function Home({ reports, lastUpdated }: HomeProps) {
  return (
    <>
      <Head>
        <title>Performance Reports Dashboard</title>
        <meta name="description" content="Web application performance monitoring dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        <header>
          <h1>Performance Reports Dashboard</h1>
          <p>Last updated: {lastUpdated}</p>
        </header>
        
        <ReportsGrid reports={reports} />
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        header {
          text-align: center;
          margin-bottom: 40px;
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        h1 {
          color: #2c3e50;
          margin-bottom: 10px;
          font-size: 2.5rem;
        }

        header p {
          color: #666;
          font-size: 1rem;
        }
      `}</style>
    </>
  )
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  try {
    const apiUrl = process.env.API_BASE_URL || 'https://perf-mon.examples.oleksiipopov.com'
    
    // Mock data for development - replace with actual API call
    const mockReports: GroupedReports = {
      "project1": {
        "prod": {
          "desktop": [
            {
              projectName: "project1",
              variantName: "desktop",
              environment: "prod",
              date: new Date().toISOString(),
              path: "reports/project1/prod/main/1234567890/desktop/index.html"
            }
          ]
        }
      }
    }

    // TODO: Replace with actual API call once deployed
    // const response = await fetch(`${apiUrl}/api/browse-reports`)
    // const reports = await response.json()

    return {
      props: {
        reports: mockReports,
        lastUpdated: new Date().toISOString(),
      },
      // Revalidate every 5 minutes (300 seconds)
      revalidate: 300,
    }
  } catch (error) {
    console.error('Error fetching reports:', error)
    return {
      props: {
        reports: {},
        lastUpdated: new Date().toISOString(),
      },
      revalidate: 300,
    }
  }
}