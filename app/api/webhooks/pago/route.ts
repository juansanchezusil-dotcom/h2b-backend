import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Capturar el correo según la estructura del webhook (Hotmart, Stripe, etc.)
    const email = body.email || body.buyer?.email || body.data?.object?.customer_email;
    const status = body.status || body.event;

    if (!email) {
      return NextResponse.json({ error: "Email no proporcionado en el webhook" }, { status: 400 });
    }

    // Inicializar cliente Supabase Admin (usa Service Role Key para escribir sin RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Evento de pago exitoso (adaptar según pasarela)
    const esPagoExitoso = ["APPROVED", "approved", "charge.succeeded", "pago_exitoso"].includes(status);
    const esCancelacion = ["REFUNDED", "CANCELED", "customer.subscription.deleted"].includes(status);

    if (esPagoExitoso) {
      const { error } = await supabaseAdmin.from("accesos").upsert(
        {
          email: email.toLowerCase().trim(),
          activo: true,
          origen: body.origen || "pasarela_pago",
        },
        { onConflict: "email" }
      );

      if (error) throw error;
      return NextResponse.json({ message: "Acceso activado correctamente", email }, { status: 200 });
    } 
    
    if (esCancelacion) {
      const { error } = await supabaseAdmin
        .from("accesos")
        .update({ activo: false })
        .eq("email", email.toLowerCase().trim());

      if (error) throw error;
      return NextResponse.json({ message: "Acceso revocado", email }, { status: 200 });
    }

    return NextResponse.json({ message: "Evento recibido pero sin acción requerida" }, { status: 200 });
  } catch (error: any) {
    console.error("Error en Webhook de Pago:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
