import { z } from "zod";
import { ToolUtils, PerformanceTracker } from "../agents/mcp.js";

/**
 * 🔗 GitHub Orchestrator
 * Real GitHub API integration with AI analysis
 */

const GitHubActionSchema = z.object({
  action: z.enum([
    "list_repos",
    "get_repo_info", 
    "list_issues",
    "create_issue",
    "get_issue",
    "list_prs",
    "get_pr",
    "analyze_repo",
    "search_code",
    "get_commits"
  ]),
  owner: z.string().optional(),
  repo: z.string().optional(),
  issue_number: z.number().optional(),
  pr_number: z.number().optional(),
  query: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  since: z.string().optional(),
  state: z.enum(["open", "closed", "all"]).optional(),
  per_page: z.number().max(100).optional(),
  page: z.number().optional()
});

export class GitHubOrchestrator {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(token: string) {
    this.token = token;
  }

  async execute(args: z.infer<typeof GitHubActionSchema>) {
    const validArgs = ToolUtils.validateArgs(GitHubActionSchema, args);
    
    return PerformanceTracker.trackExecution(
      () => this.performAction(validArgs),
      `github_${validArgs.action}`
    );
  }

  private async performAction(args: z.infer<typeof GitHubActionSchema>) {
    const headers = {
      "Authorization": `Bearer ${this.token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "ZEO-MCP-Server/2.1.0"
    };

    switch (args.action) {
      case "list_repos":
        return this.listRepositories(headers, args);
      
      case "get_repo_info":
        if (!args.owner || !args.repo) {
          throw new Error("owner and repo are required for get_repo_info");
        }
        return this.getRepositoryInfo(headers, args.owner, args.repo);
      
      case "list_issues":
        if (!args.owner || !args.repo) {
          throw new Error("owner and repo are required for list_issues");
        }
        return this.listIssues(headers, args);
      
      case "create_issue":
        if (!args.owner || !args.repo || !args.title) {
          throw new Error("owner, repo, and title are required for create_issue");
        }
        return this.createIssue(headers, args);
      
      case "get_issue":
        if (!args.owner || !args.repo || !args.issue_number) {
          throw new Error("owner, repo, and issue_number are required for get_issue");
        }
        return this.getIssue(headers, args.owner, args.repo, args.issue_number);
      
      case "list_prs":
        if (!args.owner || !args.repo) {
          throw new Error("owner and repo are required for list_prs");
        }
        return this.listPullRequests(headers, args);
      
      case "get_pr":
        if (!args.owner || !args.repo || !args.pr_number) {
          throw new Error("owner, repo, and pr_number are required for get_pr");
        }
        return this.getPullRequest(headers, args.owner, args.repo, args.pr_number);
      
      case "analyze_repo":
        if (!args.owner || !args.repo) {
          throw new Error("owner and repo are required for analyze_repo");
        }
        return this.analyzeRepository(headers, args.owner, args.repo);
      
      case "search_code":
        if (!args.query) {
          throw new Error("query is required for search_code");
        }
        return this.searchCode(headers, args);
      
      case "get_commits":
        if (!args.owner || !args.repo) {
          throw new Error("owner and repo are required for get_commits");
        }
        return this.getCommits(headers, args);
      
      default:
        throw new Error(`Unknown GitHub action: ${args.action}`);
    }
  }

  private async listRepositories(headers: any, args: any) {
    const params = new URLSearchParams();
    if (args.per_page) params.append("per_page", args.per_page.toString());
    if (args.page) params.append("page", args.page.toString());
    
    const url = `${this.baseUrl}/user/repos?${params}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const repos = await response.json();
    
    return {
      action: "list_repos",
      total_repos: repos.length,
      repositories: repos.map((repo: any) => ({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        open_issues: repo.open_issues_count,
        updated_at: repo.updated_at,
        url: repo.html_url,
        private: repo.private
      }))
    };
  }

  private async getRepositoryInfo(headers: any, owner: string, repo: string) {
    const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, { headers });
    
    if (!response.ok) {
      throw new Error(`Repository not found: ${owner}/${repo}`);
    }
    
    const repoData = await response.json();
    
    // Get additional stats
    const [languages, contributors, branches] = await Promise.all([
      fetch(`${this.baseUrl}/repos/${owner}/${repo}/languages`, { headers }).then(r => r.json()),
      fetch(`${this.baseUrl}/repos/${owner}/${repo}/contributors?per_page=10`, { headers }).then(r => r.json()),
      fetch(`${this.baseUrl}/repos/${owner}/${repo}/branches?per_page=10`, { headers }).then(r => r.json())
    ]);

    return {
      action: "get_repo_info",
      repository: {
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description,
        language: repoData.language,
        languages: languages,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        watchers: repoData.watchers_count,
        open_issues: repoData.open_issues_count,
        size: repoData.size,
        created_at: repoData.created_at,
        updated_at: repoData.updated_at,
        pushed_at: repoData.pushed_at,
        default_branch: repoData.default_branch,
        branches_count: branches.length,
        contributors_count: contributors.length,
        top_contributors: contributors.slice(0, 5).map((c: any) => ({
          login: c.login,
          contributions: c.contributions
        })),
        license: repoData.license?.name,
        topics: repoData.topics,
        url: repoData.html_url,
        clone_url: repoData.clone_url,
        private: repoData.private
      }
    };
  }

  private async listIssues(headers: any, args: any) {
    const params = new URLSearchParams();
    if (args.state) params.append("state", args.state);
    if (args.labels) params.append("labels", args.labels.join(","));
    if (args.since) params.append("since", args.since);
    if (args.per_page) params.append("per_page", args.per_page.toString());
    if (args.page) params.append("page", args.page.toString());
    
    const url = `${this.baseUrl}/repos/${args.owner}/${args.repo}/issues?${params}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch issues: ${response.status}`);
    }
    
    const issues = await response.json();
    
    return {
      action: "list_issues",
      repository: `${args.owner}/${args.repo}`,
      total_issues: issues.length,
      issues: issues.map((issue: any) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author: issue.user.login,
        labels: issue.labels.map((l: any) => l.name),
        comments: issue.comments,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        url: issue.html_url,
        body_preview: issue.body?.substring(0, 200) + (issue.body?.length > 200 ? "..." : "")
      }))
    };
  }

  private async createIssue(headers: any, args: any) {
    const body = {
      title: args.title,
      body: args.body || "",
      labels: args.labels || []
    };
    
    const response = await fetch(
      `${this.baseUrl}/repos/${args.owner}/${args.repo}/issues`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to create issue: ${response.status}`);
    }
    
    const issue = await response.json();
    
    return {
      action: "create_issue",
      success: true,
      issue: {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        created_at: issue.created_at
      }
    };
  }

  private async getIssue(headers: any, owner: string, repo: string, issueNumber: number) {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`,
      { headers }
    );
    
    if (!response.ok) {
      throw new Error(`Issue not found: #${issueNumber}`);
    }
    
    const issue = await response.json();
    
    return {
      action: "get_issue",
      issue: {
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        author: issue.user.login,
        assignees: issue.assignees.map((a: any) => a.login),
        labels: issue.labels.map((l: any) => l.name),
        comments: issue.comments,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        url: issue.html_url
      }
    };
  }

  private async listPullRequests(headers: any, args: any) {
    const params = new URLSearchParams();
    if (args.state) params.append("state", args.state);
    if (args.per_page) params.append("per_page", args.per_page.toString());
    if (args.page) params.append("page", args.page.toString());
    
    const url = `${this.baseUrl}/repos/${args.owner}/${args.repo}/pulls?${params}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch pull requests: ${response.status}`);
    }
    
    const prs = await response.json();
    
    return {
      action: "list_prs",
      repository: `${args.owner}/${args.repo}`,
      total_prs: prs.length,
      pull_requests: prs.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user.login,
        head_branch: pr.head.ref,
        base_branch: pr.base.ref,
        mergeable: pr.mergeable,
        draft: pr.draft,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        url: pr.html_url
      }))
    };
  }

  private async getPullRequest(headers: any, owner: string, repo: string, prNumber: number) {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers }
    );
    
    if (!response.ok) {
      throw new Error(`Pull request not found: #${prNumber}`);
    }
    
    const pr = await response.json();
    
    return {
      action: "get_pr",
      pull_request: {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        author: pr.user.login,
        head_branch: pr.head.ref,
        base_branch: pr.base.ref,
        mergeable: pr.mergeable,
        merged: pr.merged,
        draft: pr.draft,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        commits: pr.commits,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        merged_at: pr.merged_at,
        url: pr.html_url
      }
    };
  }

  private async analyzeRepository(headers: any, owner: string, repo: string) {
    // Collect comprehensive repo data for AI analysis
    const [repoInfo, issues, prs, releases, commits] = await Promise.all([
      this.getRepositoryInfo(headers, owner, repo),
      this.listIssues(headers, { owner, repo, state: "all", per_page: 50 }),
      this.listPullRequests(headers, { owner, repo, state: "all", per_page: 30 }),
      fetch(`${this.baseUrl}/repos/${owner}/${repo}/releases?per_page=10`, { headers }).then(r => r.json()),
      fetch(`${this.baseUrl}/repos/${owner}/${repo}/commits?per_page=30`, { headers }).then(r => r.json())
    ]);

    // AI Analysis
    const analysis = {
      repository_health: this.calculateRepoHealth(repoInfo.repository, issues, prs),
      activity_metrics: this.calculateActivityMetrics(commits, issues.issues, prs.pull_requests),
      development_patterns: this.analyzeDevelopmentPatterns(commits, prs.pull_requests),
      quality_indicators: this.calculateQualityIndicators(repoInfo.repository, issues.issues, prs.pull_requests),
      recommendations: this.generateRecommendations(repoInfo.repository, issues.issues, prs.pull_requests)
    };

    return {
      action: "analyze_repo",
      repository: `${owner}/${repo}`,
      analysis,
      summary: `Repository ${owner}/${repo} analysis complete. Health score: ${analysis.repository_health.overall_score}/100`,
      generated_at: new Date().toISOString()
    };
  }

  private async searchCode(headers: any, args: any) {
    const params = new URLSearchParams();
    params.append("q", args.query);
    if (args.per_page) params.append("per_page", args.per_page.toString());
    if (args.page) params.append("page", args.page.toString());
    
    const url = `${this.baseUrl}/search/code?${params}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Code search failed: ${response.status}`);
    }
    
    const results = await response.json();
    
    return {
      action: "search_code",
      query: args.query,
      total_count: results.total_count,
      results: results.items.map((item: any) => ({
        name: item.name,
        path: item.path,
        repository: item.repository.full_name,
        url: item.html_url,
        score: item.score
      }))
    };
  }

  private async getCommits(headers: any, args: any) {
    const params = new URLSearchParams();
    if (args.since) params.append("since", args.since);
    if (args.per_page) params.append("per_page", args.per_page.toString());
    if (args.page) params.append("page", args.page.toString());
    
    const url = `${this.baseUrl}/repos/${args.owner}/${args.repo}/commits?${params}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch commits: ${response.status}`);
    }
    
    const commits = await response.json();
    
    return {
      action: "get_commits",
      repository: `${args.owner}/${args.repo}`,
      total_commits: commits.length,
      commits: commits.map((commit: any) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        author_email: commit.commit.author.email,
        date: commit.commit.author.date,
        url: commit.html_url,
        stats: commit.stats ? {
          additions: commit.stats.additions,
          deletions: commit.stats.deletions,
          total: commit.stats.total
        } : null
      }))
    };
  }

  // AI Analysis Helper Methods
  private calculateRepoHealth(repo: any, issues: any, prs: any) {
    const scores = {
      activity: Math.min(100, (new Date().getTime() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24) < 30 ? 100 : 50),
      documentation: repo.description ? 80 : 20,
      community: Math.min(100, repo.stars * 2),
      maintenance: issues.issues.filter((i: any) => i.state === 'open').length < 10 ? 90 : 60,
      releases: repo.topics?.length > 0 ? 70 : 40
    };

    return {
      ...scores,
      overall_score: Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length)
    };
  }

  private calculateActivityMetrics(commits: any[], issues: any[], prs: any[]) {
    const now = new Date();
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      recent_commits: commits.filter(c => new Date(c.commit?.author?.date || c.date) > lastMonth).length,
      recent_issues: issues.filter(i => new Date(i.created_at) > lastMonth).length,
      recent_prs: prs.filter(pr => new Date(pr.created_at) > lastMonth).length,
      commit_frequency: commits.length / 30, // per day average
      issue_resolution_rate: issues.filter((i: any) => i.state === 'closed').length / Math.max(1, issues.length)
    };
  }

  private analyzeDevelopmentPatterns(commits: any[], prs: any[]) {
    const commitMessages = commits.map(c => c.commit?.message || c.message || '').filter(Boolean);
    const conventionalCommits = commitMessages.filter(msg => /^(feat|fix|docs|style|refactor|test|chore):/.test(msg));

    return {
      conventional_commits_usage: conventionalCommits.length / Math.max(1, commitMessages.length),
      average_pr_size: prs.length > 0 ? (prs.reduce((sum: number, pr: any) => sum + (pr.additions || 0) + (pr.deletions || 0), 0) / prs.length) : 0,
      merge_patterns: {
        direct_merges: prs.filter((pr: any) => pr.merged && !pr.draft).length,
        draft_usage: prs.filter((pr: any) => pr.draft).length / Math.max(1, prs.length)
      }
    };
  }

  private calculateQualityIndicators(repo: any, issues: any[], prs: any[]) {
    return {
      test_coverage: repo.languages?.['TypeScript'] ? 'likely_good' : 'unknown',
      documentation_quality: repo.description && repo.topics?.length > 0 ? 'good' : 'needs_improvement',
      issue_management: issues.filter(i => i.labels.length > 0).length / Math.max(1, issues.length),
      code_review_practice: prs.filter(pr => pr.comments > 0).length / Math.max(1, prs.length),
      release_management: repo.topics?.includes('release') ? 'automated' : 'manual'
    };
  }

  private generateRecommendations(repo: any, issues: any[], prs: any[]) {
    const recommendations = [];

    if (!repo.description) {
      recommendations.push("Add a comprehensive repository description");
    }

    if (repo.open_issues > 20) {
      recommendations.push("Consider triaging and closing old issues");
    }

    if (prs.filter(pr => pr.draft).length / Math.max(1, prs.length) < 0.3) {
      recommendations.push("Consider using draft PRs for work-in-progress features");
    }

    if (repo.topics?.length < 3) {
      recommendations.push("Add more topics to improve discoverability");
    }

    return recommendations;
  }
}