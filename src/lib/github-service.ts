
'use server';

import type { FeedData } from '@/types';

const GITHUB_API_BASE_URL = 'https://api.github.com';

interface GitHubFileResponse {
  content: string; // Base64 encoded content
  sha: string;
  download_url: string | null;
  // other fields omitted for brevity
}

interface GetGitHubRepoDetailsResult {
  token: string;
  owner: string;
  repo: string;
  filePath: string;
  branch: string;
}

function getGitHubRepoDetails(): GetGitHubRepoDetailsResult {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const filePath = process.env.GITHUB_FILE_PATH;
  const branch = process.env.GITHUB_BRANCH;

  if (!token || !owner || !repo || !filePath || !branch) {
    throw new Error(
      'Missing GitHub configuration in environment variables. Please set GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME, GITHUB_FILE_PATH, and GITHUB_BRANCH.'
    );
  }
  return { token, owner, repo, filePath, branch };
}

export async function getRepoFileContent(): Promise<{ data: FeedData; sha: string | null; rawContent: string }> {
  const { token, owner, repo, filePath, branch } = getGitHubRepoDetails();
  const url = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-store', // Ensure fresh data
    });

    if (response.status === 404) {
      // File not found, return default empty structure
      return { data: {}, sha: null, rawContent: "{}" };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`GitHub API error (${response.status}): ${errorData.message || 'Failed to fetch file'}`);
    }

    const fileData = (await response.json()) as GitHubFileResponse;
    const decodedContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    
    let parsedData: FeedData;
    try {
        parsedData = JSON.parse(decodedContent || '{}') as FeedData;
        // Basic validation, similar to original readFeedFile
        if (typeof parsedData !== 'object' || parsedData === null || Array.isArray(parsedData)) {
            console.warn('feed.json from GitHub is not in the expected object format, returning empty data.');
            parsedData = {};
        } else {
            for (const key in parsedData) {
                if (typeof parsedData[key] !== 'object' || parsedData[key] === null ||
                    typeof (parsedData[key] as any).name !== 'string' ||
                    typeof (parsedData[key] as any).discordChannel !== 'string') {
                    console.warn(`Invalid channel entry in feed.json from GitHub for key ${key}, returning empty data.`);
                    parsedData = {}; 
                    break;
                }
            }
        }
    } catch (e) {
        console.warn('Error parsing feed.json content from GitHub, returning empty data:', e);
        parsedData = {};
    }
    
    return { data: parsedData, sha: fileData.sha, rawContent: decodedContent || "{}" };
  } catch (error) {
    console.error('Error fetching file from GitHub:', error);
    if (error instanceof Error && error.message.startsWith('GitHub API error (404)')) {
         return { data: {}, sha: null, rawContent: "{}" };
    }
    // For other errors, rethrow or handle as appropriate
    // For simplicity, returning default structure on other errors too for now.
    // A more robust solution might throw specific error types.
    // throw error; // Or return a default if preferred for non-404s.
    console.error('Unexpected error in getRepoFileContent, returning default. Error:', error);
    return { data: {}, sha: null, rawContent: "{}" };
  }
}

export async function updateRepoFileContent(
  newContent: string, // JSON string
  commitMessage: string,
  currentSha: string | null // SHA of the file being updated, null if creating new
): Promise<{ success: boolean; message?: string }> {
  const { token, owner, repo, filePath, branch } = getGitHubRepoDetails();
  const url = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contents/${filePath}`;

  const encodedContent = Buffer.from(newContent, 'utf-8').toString('base64');

  const body: { message: string; content: string; branch: string; sha?: string } = {
    message: commitMessage,
    content: encodedContent,
    branch: branch,
  };

  if (currentSha) {
    body.sha = currentSha;
  }

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
       console.error('GitHub API error response:', errorData);
      throw new Error(`GitHub API error (${response.status}) updating file: ${errorData.message || 'Failed to update file'}`);
    }
    return { success: true };
  } catch (error) {
    console.error('Error updating file in GitHub:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while updating the file in GitHub.';
    return { success: false, message: errorMessage };
  }
}
