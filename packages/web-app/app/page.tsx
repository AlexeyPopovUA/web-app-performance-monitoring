import {ReportsGrid} from '@/components/ReportsGrid'

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


export default async function Home() {
  const {reports, lastUpdated} = await getReportsData();

  return (
    <main className="container">
      <header>
        <h1>Performance Reports Dashboard</h1>
        <p>Last updated: {lastUpdated}</p>
      </header>

      <ReportsGrid reports={reports}/>
    </main>
  )
}

async function getReportsData(): Promise<HomeProps> {
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
      reports: mockReports,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error fetching reports:', error)
    return {
      reports: {},
      lastUpdated: new Date().toISOString(),
    }
  }
}