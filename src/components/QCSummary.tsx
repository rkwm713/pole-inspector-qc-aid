import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QCCheckStatus, QCResults, Pole, QCCheckResult } from "@/types";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle,
  CheckCircle2, 
  XCircle, 
  Info 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QCSummaryProps {
  poles: Pole[];
}

export function QCSummary({ poles }: QCSummaryProps) {
  // Count poles with each QC status
  const passCount = poles.filter(pole => pole.qcResults?.overallStatus === "PASS").length;
  const warningCount = poles.filter(pole => pole.qcResults?.overallStatus === "WARNING").length;
  const failCount = poles.filter(pole => pole.qcResults?.overallStatus === "FAIL").length;
  const notCheckedCount = poles.filter(
    pole => !pole.qcResults || pole.qcResults.overallStatus === "NOT_CHECKED"
  ).length;
  
  const totalPoles = poles.length;
  
  // Calculate percentages
  const passPercentage = totalPoles ? Math.round((passCount / totalPoles) * 100) : 0;
  const warningPercentage = totalPoles ? Math.round((warningCount / totalPoles) * 100) : 0;
  const failPercentage = totalPoles ? Math.round((failCount / totalPoles) * 100) : 0;
  const notCheckedPercentage = totalPoles ? Math.round((notCheckedCount / totalPoles) * 100) : 0;
  
  // Count individual QC checks across all poles
  const checkCounts = poles.reduce((counts, pole) => {
    if (!pole.qcResults) return counts;
    
    const qc = pole.qcResults;
    const checks = [
      qc.ownerCheck,
      qc.anchorCheck,
      qc.poleSpecCheck,
      qc.assemblyUnitsCheck,
      qc.glcCheck,
      qc.poleOrderCheck,
      qc.tensionCheck,
      qc.attachmentSpecCheck,
      qc.heightCheck,
      qc.specFileCheck,
      qc.clearanceCheck
    ];
    
    checks.forEach(check => {
      if (check.status === "PASS") counts.pass++;
      else if (check.status === "WARNING") counts.warning++;
      else if (check.status === "FAIL") counts.fail++;
    });
    
    return counts;
  }, { pass: 0, warning: 0, fail: 0 });
  
  const totalChecks = checkCounts.pass + checkCounts.warning + checkCounts.fail;
  
  // Common QC issues
  interface IssueCount {
    check: string;
    count: number;
    status: QCCheckStatus;
  }
  
  const issueCountsByCheck: Record<string, IssueCount> = {};
  
  poles.forEach(pole => {
    if (!pole.qcResults) return;
    
    const checkTypes = [
      { key: "ownerCheck", name: "Owner Consistency" },
      { key: "anchorCheck", name: "Anchor & Guy Wire" },
      { key: "poleSpecCheck", name: "Pole Specifications" },
      { key: "assemblyUnitsCheck", name: "Assembly Units" },
      { key: "glcCheck", name: "Ground-Line Circumference" },
      { key: "tensionCheck", name: "Wire Tensions" },
      { key: "clearanceCheck", name: "Clearance Checks" }
    ];
    
    checkTypes.forEach(({ key, name }) => {
      const check = pole.qcResults?.[key as keyof QCResults] as QCCheckResult;
      if (!check || check.status === "PASS" || check.status === "NOT_CHECKED") return;
      
      if (!issueCountsByCheck[name]) {
        issueCountsByCheck[name] = {
          check: name,
          count: 0,
          status: check.status
        };
      }
      
      issueCountsByCheck[name].count++;
      
      // If any check has FAIL status, update the overall status to FAIL
      if (check.status === "FAIL") {
        issueCountsByCheck[name].status = "FAIL";
      }
    });
  });
  
  // Sort by count and status (fail first, then warning)
  const commonIssues = Object.values(issueCountsByCheck)
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "FAIL" ? -1 : 1;
      }
      return b.count - a.count;
    })
    .slice(0, 5); // Top 5 issues
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quality Control Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
              <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
              <div className="text-2xl font-bold">{passCount}</div>
              <div className="text-sm text-muted-foreground">Passing</div>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
              <AlertTriangle className="h-10 w-10 text-yellow-500 mb-2" />
              <div className="text-2xl font-bold">{warningCount}</div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
              <XCircle className="h-10 w-10 text-red-500 mb-2" />
              <div className="text-2xl font-bold">{failCount}</div>
              <div className="text-sm text-muted-foreground">Failing</div>
            </div>
            
            <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
              <Info className="h-10 w-10 text-blue-500 mb-2" />
              <div className="text-2xl font-bold">{notCheckedCount}</div>
              <div className="text-sm text-muted-foreground">Not Checked</div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Pole Status Distribution</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm">Pass</span>
                </div>
                <span className="text-sm font-medium">{passPercentage}%</span>
              </div>
              <Progress value={passPercentage} className="h-2 bg-muted">
                <div className="h-full bg-green-500 rounded-full" />
              </Progress>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-full bg-yellow-500 mr-2"></div>
                  <span className="text-sm">Warning</span>
                </div>
                <span className="text-sm font-medium">{warningPercentage}%</span>
              </div>
              <Progress value={warningPercentage} className="h-2 bg-muted">
                <div className="h-full bg-yellow-500 rounded-full" />
              </Progress>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-sm">Fail</span>
                </div>
                <span className="text-sm font-medium">{failPercentage}%</span>
              </div>
              <Progress value={failPercentage} className="h-2 bg-muted">
                <div className="h-full bg-red-500 rounded-full" />
              </Progress>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-full bg-gray-400 mr-2"></div>
                  <span className="text-sm">Not Checked</span>
                </div>
                <span className="text-sm font-medium">{notCheckedPercentage}%</span>
              </div>
              <Progress value={notCheckedPercentage} className="h-2 bg-muted">
                <div className="h-full bg-gray-400 rounded-full" />
              </Progress>
            </div>
          </div>
          
          {commonIssues.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Common QC Issues</h3>
              <div className="space-y-2">
                {commonIssues.map((issue, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                    <div className="flex items-center">
                      {issue.status === "FAIL" ? (
                        <XCircle className="h-4 w-4 text-red-500 mr-2" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                      )}
                      <span className="text-sm">{issue.check}</span>
                    </div>
                    <Badge variant={issue.status === "FAIL" ? "destructive" : "outline"}>
                      {issue.count} {issue.count === 1 ? "pole" : "poles"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="border-t pt-4">
            <div className="text-sm text-muted-foreground">
              <p><strong>{totalPoles}</strong> poles analyzed with <strong>{totalChecks}</strong> total checks performed.</p>
              <p className="mt-1">
                <span className="text-green-600 font-medium">{checkCounts.pass}</span> passed, 
                <span className="text-yellow-600 font-medium mx-1">{checkCounts.warning}</span> warnings, and 
                <span className="text-red-600 font-medium ml-1">{checkCounts.fail}</span> failures detected.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
