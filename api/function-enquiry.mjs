const RECIPIENT = process.env.FUNCTION_ENQUIRY_TO || "lucaslewis741@gmail.com";
const SENDER = process.env.RESEND_FROM || "WineBank Website <onboarding@resend.dev>";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8" }
});

const clean = (value, limit) => String(value ?? "").trim().slice(0, limit);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export async function POST(request) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured.");
    return json({ error: "Email service is not configured." }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  // Bots commonly fill this hidden field; real visitors leave it empty.
  if (clean(payload.website, 200)) return json({ ok: true });

  const name = clean(payload.name, 120);
  const email = clean(payload.email, 254).toLowerCase();
  const phone = clean(payload.phone, 50);
  const subject = clean(payload.subject, 140) || "Private function enquiry";
  const message = clean(payload.message, 5000);

  if (!name || !validEmail(email) || !message) {
    return json({ error: "Please enter your name, a valid email address and a message." }, 400);
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || "Not provided");
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: SENDER,
      to: [RECIPIENT],
      reply_to: email,
      subject: `[WineBank Functions] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "Not provided"}\n\n${message}`,
      html: `<h2>New WineBank function enquiry</h2><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Phone:</strong> ${safePhone}</p><hr /><p>${safeMessage}</p>`
    })
  });

  if (!resendResponse.ok) {
    const details = await resendResponse.text();
    console.error("Resend rejected the function enquiry:", details);
    return json({ error: "The enquiry could not be sent. Please try again or call (03) 5444 4655." }, 502);
  }

  return json({ ok: true });
}
