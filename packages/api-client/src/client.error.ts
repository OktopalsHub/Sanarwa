import { AxiosError } from "axios";
import { ApiError } from "./client.types";

export function transformApiError(error: AxiosError): ApiError {
  const apiError = new Error() as ApiError;
  apiError.isAxiosError = true;

  if (error.response) {
    const responseData = error.response.data as any;

    apiError.status = error.response.status;
    apiError.message =
      responseData?.message || error.message || `HTTP error! status: ${error.response.status}`;
    apiError.code = responseData?.code;
    apiError.details = responseData?.details;

    switch (error.response.status) {
      case 403:
        if (responseData?.code === "TENANT_ACCESS_DENIED") {
          apiError.message = "You do not have access to this tenant";
        }
        break;
      case 404:
        if (responseData?.code === "TENANT_NOT_FOUND") {
          apiError.message = "Tenant not found";
        }
        break;
      case 429:
        apiError.message = "Too many requests. Please try again later.";
        break;
    }
  } else if (error.request) {
    apiError.message = "Network error. Please check your connection.";
    apiError.code = "NETWORK_ERROR";
  } else {
    apiError.message = error.message || "An unexpected error occurred";
    apiError.code = "UNKNOWN_ERROR";
  }

  return apiError;
}
