import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export async function enviarEmailRecuperacaoSenha(destinatario: string, link: string): Promise<void> {
  const from = process.env.SMTP_FROM || 'no-reply@barbeariamaraca.com';
  await getTransporter().sendMail({
    from,
    to: destinatario,
    subject: 'Recuperação de senha — Barbearia Maracá',
    text: `Recebemos uma solicitação para redefinir sua senha. Acesse o link para continuar (válido por um tempo limitado): ${link}\n\nSe você não solicitou, ignore este e-mail.`,
    html: `<p>Recebemos uma solicitação para redefinir sua senha.</p>
<p><a href="${link}">Clique aqui para redefinir sua senha</a></p>
<p>O link expira em breve. Se você não solicitou, ignore este e-mail.</p>`,
  });
}
