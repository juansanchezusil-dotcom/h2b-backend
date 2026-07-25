import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { fetchSeasonalJobs } from "./sources/seasonalJobs.ts";
import { fetchUscisData } from "./sources/uscis.ts";
import { fetchCareerOneStop } from "./sources/careerOneStop.ts";
import { fetchDolRecruiters } from "./sources/dolRecruiters.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("PROJECT_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Faltan variables de entorno." }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Ejecutar todas las extracciones de forma simultánea
    const [seasonal, uscis, careerOne, recruiters] = await Promise.all([
      fetchSeasonalJobs(),
      fetchUscisData(),
      fetchCareerOneStop(),
      fetchDolRecruiters()
    ]);

    const allJobs = [...seasonal, ...uscis, ...careerOne, ...recruiters];

    if (allJobs.length === 0) {
      return new Response(JSON.stringify({ message: "No se obtuvieron registros", inserted: 0 }), { status: 200 });
    }

    // Insertar registros consolidados en Supabase
    const { data: insertedData, error } = await supabase
      .from("jobs")
      .insert(allJobs)
      .select();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        message: "Proceso completado con éxito",
        total_inserted: insertedData?.length || 0,
        breakdown: {
          seasonalJobs: seasonal.length,
          uscis: uscis.length,
          careerOneStop: careerOne.length,
          dolRecruiters: recruiters.length
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});