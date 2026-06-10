/**
 * Figma-specific error types and parsing utilities.
 * Provides granular error handling for Figma API responses.
 */

// Error codes for soft-error pattern (HTTP 200 with error in body)
export const FigmaErrorCodes = {
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  RATE_LIMITED: "RATE_LIMITED", 
  FIGMA_QUOTA_EXCEEDED: "FIGMA_QUOTA_EXCEEDED",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  NODE_NOT_FOUND: "NODE_NOT_FOUND",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_REQUIRED: "TOKEN_REQUIRED",
  DECRYPTION_ERROR: "DECRYPTION_ERROR",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
} as const;

export type FigmaErrorCode = typeof FigmaErrorCodes[keyof typeof FigmaErrorCodes];

export interface FigmaErrorResponse {
  success: false;
  error: FigmaErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

/**
 * Parse Figma API error response and return appropriate error details.
 * Implements granular error parsing based on status code and response body.
 */
export async function parseFigmaApiError(
  response: Response
): Promise<FigmaErrorResponse> {
  const status = response.status;
  let errorBody = "";
  
  try {
    errorBody = await response.text();
  } catch {
    // Ignore body parsing errors
  }
  
  const errorBodyLower = errorBody.toLowerCase();
  
  // Step 2: Granular Figma Error Parsing
  
  // 429 - Rate Limit
  if (status === 429) {
    const retryAfterRaw = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterRaw ? parseInt(retryAfterRaw, 10) : 60;
    
    return {
      success: false,
      error: FigmaErrorCodes.RATE_LIMITED,
      message: "You're moving too fast. Free Figma plans: about 6 image exports per month. Pro plans (Dev, Full): about 10 per minute. Wait a moment or upgrade your Figma plan.",
      retryAfterSeconds,
    };
  }
  
  // 403 - Check for Figma quota/payment issues vs token issues
  if (status === 403) {
    // Check if it's a Figma account quota issue
    if (
      errorBodyLower.includes("quota") || 
      errorBodyLower.includes("payment") ||
      errorBodyLower.includes("limit") ||
      errorBodyLower.includes("exceeded")
    ) {
      return {
        success: false,
        error: FigmaErrorCodes.FIGMA_QUOTA_EXCEEDED,
        message: "Figma Monthly Limit Reached. Free Figma accounts are limited to ~6 API calls per month. Please upgrade Figma or use a different account.",
      };
    }
    
    // Generic 403 - token issue
    return {
      success: false,
      error: FigmaErrorCodes.TOKEN_EXPIRED,
      message: "Token Invalid or Expired. Please regenerate your Personal Access Token in Figma settings.",
    };
  }
  
  // 401 - Authentication failed
  if (status === 401) {
    return {
      success: false,
      error: FigmaErrorCodes.TOKEN_EXPIRED,
      message: "Token Invalid or Expired. Please regenerate your Personal Access Token in Figma settings.",
    };
  }
  
  // 404 - File or node not found
  if (status === 404) {
    return {
      success: false,
      error: FigmaErrorCodes.FILE_NOT_FOUND,
      message: "Figma File or Node not found. Please check your link and ensure the file is accessible.",
    };
  }
  
  // Default for other errors
  return {
    success: false,
    error: FigmaErrorCodes.TOKEN_EXPIRED,
    message: `Figma API returned an error (${status}). Please try again or check your token.`,
  };
}

/**
 * Create a standardized error response with CORS headers.
 */
export function createErrorResponse(
  error: FigmaErrorResponse,
  corsHeaders: Record<string, string>
): Response {
  // Use HTTP 200 for soft errors that the frontend should handle gracefully
  const softErrorCodes: FigmaErrorCode[] = [
    FigmaErrorCodes.QUOTA_EXCEEDED,
    FigmaErrorCodes.RATE_LIMITED,
    FigmaErrorCodes.FIGMA_QUOTA_EXCEEDED,
    FigmaErrorCodes.TOKEN_EXPIRED,
    FigmaErrorCodes.TOKEN_REQUIRED,
    FigmaErrorCodes.DECRYPTION_ERROR,
  ];
  
  const status = softErrorCodes.includes(error.error) ? 200 : 400;
  
  return new Response(
    JSON.stringify(error),
    { 
      status, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

/**
 * Create quota exceeded error response.
 */
export function createQuotaExceededError(): FigmaErrorResponse {
  return {
    success: false,
    error: FigmaErrorCodes.QUOTA_EXCEEDED,
    message: "Daily audit limit reached. Your limit resets at midnight (Europe/Rome). Upgrade for unlimited access.",
  };
}

/**
 * Create decryption error response.
 * Used when token decryption fails due to server-side issues.
 */
export function createDecryptionError(): FigmaErrorResponse {
  return {
    success: false,
    error: FigmaErrorCodes.DECRYPTION_ERROR,
    message: "Your saved Figma token could not be decrypted due to a configuration issue. Please paste a new token to continue.",
  };
}

/**
 * Create token required error response.
 */
export function createTokenRequiredError(): FigmaErrorResponse {
  return {
    success: false,
    error: FigmaErrorCodes.TOKEN_REQUIRED,
    message: "No Figma access token found. Please provide your Personal Access Token.",
  };
}
