import { createConnection, type Socket } from "net";
import { connect as tlsConnect, type TLSSocket } from "tls";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function encodeSubject(subject: string) {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

/**
 * Dev-friendly mailer: logs to the console when SMTP is unset.
 * When SMTP_HOST + SMTP_FROM are set, sends over SMTP (AUTH LOGIN + STARTTLS).
 */
export async function sendMail({ to, subject, text }: SendMailInput) {
  if (!smtpConfigured()) {
    console.info(`[mail:dev] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }

  await sendSmtpMail({ to, subject, text });
}

async function sendSmtpMail({ to, subject, text }: SendMailInput) {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || "587");
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;
  const from = process.env.SMTP_FROM!;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const socket: Socket | TLSSocket = secure
    ? await connectTls(host, port)
    : await connectPlain(host, port);

  const session = new SmtpSession(socket);

  try {
    await session.expect(220);
    await session.command(`EHLO localhost`, 250);

    if (!secure) {
      await session.command("STARTTLS", 220);
      const upgraded = await upgradeToTls(socket as Socket, host);
      session.replaceSocket(upgraded);
      await session.command(`EHLO localhost`, 250);
    }

    if (user && pass) {
      await session.command("AUTH LOGIN", 334);
      await session.command(Buffer.from(user).toString("base64"), 334);
      await session.command(Buffer.from(pass).toString("base64"), 235);
    }

    const fromAddress = extractEmail(from);
    await session.command(`MAIL FROM:<${fromAddress}>`, 250);
    await session.command(`RCPT TO:<${to}>`, 250);
    await session.command("DATA", 354);

    const body = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      text.replace(/\r?\n/g, "\r\n"),
      ".",
    ].join("\r\n");

    await session.command(body, 250);
    await session.command("QUIT", 221);
  } finally {
    session.close();
  }
}

function extractEmail(value: string) {
  const match = value.match(/<([^>]+)>/);
  return match?.[1] ?? value.trim();
}

function connectPlain(host: string, port: number) {
  return new Promise<Socket>((resolve, reject) => {
    const socket = createConnection({ host, port }, () => resolve(socket));
    socket.setEncoding("utf8");
    socket.on("error", reject);
  });
}

function connectTls(host: string, port: number) {
  return new Promise<TLSSocket>((resolve, reject) => {
    const socket = tlsConnect({ host, port, servername: host }, () =>
      resolve(socket),
    );
    socket.setEncoding("utf8");
    socket.on("error", reject);
  });
}

function upgradeToTls(socket: Socket, host: string) {
  return new Promise<TLSSocket>((resolve, reject) => {
    const upgraded = tlsConnect({ socket, host, servername: host }, () =>
      resolve(upgraded),
    );
    upgraded.setEncoding("utf8");
    upgraded.on("error", reject);
  });
}

class SmtpSession {
  private buffer = "";
  private waiters: Array<{
    code: number;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(private socket: Socket | TLSSocket) {
    this.socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.flush();
    });
  }

  replaceSocket(socket: Socket | TLSSocket) {
    this.socket.removeAllListeners("data");
    this.socket = socket;
    this.socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.flush();
    });
  }

  command(line: string, expectCode: number) {
    this.socket.write(`${line}\r\n`);
    return this.expect(expectCode);
  }

  expect(code: number) {
    return new Promise<void>((resolve, reject) => {
      this.waiters.push({ code, resolve, reject });
      this.flush();
    });
  }

  close() {
    this.socket.end();
  }

  private flush() {
    while (this.waiters.length > 0) {
      const lines = this.buffer.split(/\r?\n/);
      if (lines.length < 2) return;

      let end = -1;
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (/^\d{3} /.test(line)) {
          end = i;
          break;
        }
      }
      if (end < 0) return;

      const responseLines = lines.slice(0, end + 1);
      this.buffer = lines.slice(end + 1).join("\n");
      const last = responseLines[responseLines.length - 1] ?? "";
      const responseCode = Number(last.slice(0, 3));
      const waiter = this.waiters.shift()!;

      if (responseCode !== waiter.code) {
        waiter.reject(
          new Error(
            `SMTP expected ${waiter.code}, got ${responseCode}: ${responseLines.join(" | ")}`,
          ),
        );
      } else {
        waiter.resolve();
      }
    }
  }
}
