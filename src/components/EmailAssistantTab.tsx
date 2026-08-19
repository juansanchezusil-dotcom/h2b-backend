import React, { useState } from 'react';
import { Mail, Copy, ExternalLink, Sparkles, Check, RefreshCw } from 'lucide-react';

interface EmailAssistantProps {
  initialJobTitle?: string;
  initialCompanyName?: string;
  initialContactEmail?: string;
  candidateName?: string;
}

export function EmailAssistantTab({
  initialJobTitle = "Trabajador Agrícola / H-2B",
  initialCompanyName = "Empresa Patrocinadora LLC",
  initialContactEmail = "reclutamiento@empresa.com",
  candidateName = "Juan Pérez",
}: EmailAssistantProps) {
  const [emailType, setEmailType] = useState<'initial' | 'followup_7d' | 'followup_14d'>('initial');
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [copied, setCopied] = useState(false);

  // Plantillas de correos pre-redactadas (Simulación del Asistente IA)
  const generateEmailBody = () => {
    if (emailType === 'initial') {
      return `Estimado equipo de reclutamiento de ${companyName},

Espero que se encuentren muy bien.

Mi nombre es ${candidateName} y me pongo en contacto con ustedes para expresar mi fuerte interés en la posición de ${jobTitle} bajo el programa de visas H-2B.

Cuento con experiencia previa comprobable y la disponibilidad completa para incorporarme en las fechas requeridas. Adjunto a este correo mi Currículum Vitae para que puedan revisar mi historial laboral.

Agradezco de antemano su tiempo y consideración. Quedo atento a cualquier duda o para coordinar una entrevista.

Atentamente,
${candidateName}`;
    }

    if (emailType === 'followup_7d') {
      return `Estimado equipo de reclutamiento de ${companyName},

Espero que estén teniendo una excelente semana.

Le escribo para darle seguimiento a mi postulación enviada recientemente para la vacante de ${jobTitle} (Programa H-2B). Deseaba reconfirmar mi gran interés en formar parte de su equipo de trabajo para esta temporada.

Quedo a su entera disposición en caso de que requieran información adicional o mi documentación complementaria.

Saludos cordiales,
${candidateName}`;
    }

    return `Estimado equipo de reclutamiento de ${companyName},

Espero que se encuentren muy bien.

Me contacto nuevamente en relación con la posición de ${jobTitle}. Comprendo que la revisión de solicitudes toma tiempo, por lo que únicamente deseaba reiterar mi disponibilidad inmediata y compromiso para esta vacante H-2B.

Agradezco nuevamente su atención y quedo a la espera de sus comentarios.

Atentamente,
${candidateName}`;
  };

  const getSubject = () => {
    if (emailType === 'initial') return `Postulación Visa H-2B: ${jobTitle} - ${candidateName}`;
    return `Seguimiento de Postulación: ${jobTitle} - ${candidateName}`;
  };

  const emailBody = generateEmailBody();
  const subject = getSubject();

  // Función para copiar el cuerpo al portapapeles
  const handleCopy = () => {
    navigator.clipboard.writeText(emailBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Enlace mailto universal
  const handleMailto = () => {
    const mailtoUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoUrl;
  };

  // Redirección directa a Webmails
  const handleOpenWebmail = (provider: 'gmail' | 'outlook') => {
    let url = '';
    if (provider === 'gmail') {
      url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contactEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    } else if (provider === 'outlook') {
      url = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(contactEmail)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    }
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center space-x-3 border-b border-slate-200 pb-4">
        <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Asistente de Correo IA</h2>
          <p className="text-sm text-slate-500">Redacta y envía correos profesionales a empleadores H-2B en un clic.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Panel Izquierdo: Configuración y Datos */}
        <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <h3 className="font-semibold text-slate-700 text-sm">1. Tipo de Correo</h3>
          <div className="space-y-2">
            {[
              { id: 'initial', label: 'Contacto Inicial / Postulación' },
              { id: 'followup_7d', label: 'Primer Seguimiento (7 días)' },
              { id: 'followup_14d', label: 'Segundo Seguimiento (14 días)' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setEmailType(type.id as any)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  emailType === type.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <hr className="border-slate-200 my-4" />

          <h3 className="font-semibold text-slate-700 text-sm">2. Datos de la Oferta</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Empresa Patrocinadora</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Puesto / Vacante</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Correo del Reclutador</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Panel Derecho: Previsualización y Envío */}
        <div className="md:col-span-2 space-y-4 flex flex-col justify-between">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 flex-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Previsualización</span>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

            <div className="text-xs text-slate-500">
              <strong className="text-slate-700">Asunto:</strong> {subject}
            </div>

            <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed border border-slate-100 min-h-[220px]">
              {emailBody}
            </div>
          </div>

          {/* Opciones de Envío Directo */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3">
            <span className="text-xs font-medium text-slate-300 block">Enviar mensaje directamente con:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handleOpenWebmail('gmail')}
                className="flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Abrir Gmail</span>
              </button>

              <button
                onClick={() => handleOpenWebmail('outlook')}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Abrir Outlook</span>
              </button>

              <button
                onClick={handleMailto}
                className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white py-2.5 px-3 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>App Predeterminada</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}