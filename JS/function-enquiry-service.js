export async function sendFunctionEnquiry(details) {
  const response = await fetch('/api/function-enquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details)
  });

  let result = {};
  try {
    result = await response.json();
  } catch {
    // Use the fallback message below when a non-JSON response is returned.
  }

  if (!response.ok) {
    throw new Error(result.error || 'The enquiry could not be sent. Please try again.');
  }
  return result;
}
