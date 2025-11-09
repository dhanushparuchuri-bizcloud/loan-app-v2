"use client"

export default function DebugEnvPage() {
  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Environment Variables Debug</h1>
        <div className="bg-card p-6 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="font-semibold">Variable</div>
            <div className="font-semibold">Value</div>

            <div>NEXT_PUBLIC_COGNITO_DOMAIN</div>
            <div className="font-mono text-sm break-all">
              {process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "❌ undefined"}
            </div>

            <div>NEXT_PUBLIC_COGNITO_CLIENT_ID</div>
            <div className="font-mono text-sm break-all">
              {process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "❌ undefined"}
            </div>

            <div>NEXT_PUBLIC_COGNITO_REGION</div>
            <div className="font-mono text-sm break-all">
              {process.env.NEXT_PUBLIC_COGNITO_REGION || "❌ undefined"}
            </div>

            <div>NEXT_PUBLIC_COGNITO_USER_POOL_ID</div>
            <div className="font-mono text-sm break-all">
              {process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "❌ undefined"}
            </div>

            <div>NEXT_PUBLIC_API_URL</div>
            <div className="font-mono text-sm break-all">
              {process.env.NEXT_PUBLIC_API_URL || "❌ undefined"}
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h2 className="font-semibold mb-2">Instructions:</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Go to AWS Amplify Console</li>
            <li>Select your app</li>
            <li>Go to "Environment variables" in the left sidebar</li>
            <li>Add all variables shown above with their correct values</li>
            <li>Click "Save"</li>
            <li>Go to "Deployments" and click "Redeploy this version"</li>
            <li>Wait for build to complete</li>
            <li>Refresh this page to verify</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
