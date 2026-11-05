<template>
  <LegalPage title="Términos del servicio" :version="TERMS.version" :effective-date="TERMS.effectiveDate">
    <p>
      Estos términos regulan el uso de Servify POS y la relación entre quien lo presta y cada negocio que lo contrata.
      Aplican a:
    </p>
    <ul>
      <li>el panel web de gestión, en <a :href="SITE">{{ SITE }}</a>;</li>
      <li>la aplicación Android para meseros "Servify POS" (paquete com.servifypos.app), distribuida en Google Play;</li>
      <li>la API que usan ambos, en https://api.servifypos.com.</li>
    </ul>
    <p>
      En adelante, todo eso es "el servicio". El tratamiento de los datos personales se rige además por la
      <a :href="policyHref">política de privacidad y de tratamiento de datos personales</a>, que forma parte de estos
      términos.
    </p>

    <h2 id="prestador" class="text-h6">1. Quién presta el servicio</h2>
    <ul>
      <li>
        Nombre: {{ OWNER.name }}, persona natural, quien presta el servicio bajo la marca Servify POS y publica la
        aplicación en Google Play.
      </li>
      <li>Domicilio: {{ OWNER.city }}, Colombia.</li>
      <li>Dirección: {{ OWNER.address }}.</li>
      <li>Correo electrónico: <a :href="mailto">{{ OWNER.email }}</a>.</li>
      <li>Teléfono: {{ OWNER.phone }}.</li>
    </ul>
    <p>En adelante, "Servify POS" se refiere a esta persona.</p>

    <h2 id="aceptacion" class="text-h6">2. A quién aplican y cómo se aceptan</h2>
    <ul>
      <li>
        <strong>Negocio cliente</strong> (o "el negocio"): la persona natural o jurídica que contrata el servicio para
        su establecimiento.
      </li>
      <li>
        <strong>Usuarios:</strong> las personas que entran al servicio con una cuenta, es decir, los administradores y
        los empleados del negocio.
      </li>
      <li>
        <strong>Condiciones comerciales:</strong> el plan, los módulos, los límites (por ejemplo, el número de mesas y
        de usuarios) y el valor mensual que el negocio y Servify POS acuerdan al contratar, y que Servify POS confirma
        por escrito.
      </li>
      <li>
        El negocio acepta estos términos al contratar el servicio, por escrito o por un mensaje de datos, como un
        correo electrónico en el que confirme que los leyó y los acepta (art. 14 de la Ley 527 de 1999). Pagar el
        servicio o seguir usándolo después del periodo de prueba también confirma la aceptación.
      </li>
      <li>Quien acepta en nombre de un negocio declara que tiene facultad para obligarlo.</li>
      <li>
        Cada usuario debe respetar las reglas de uso de la sección 9. El negocio responde por que sus usuarios las
        conozcan y las cumplan.
      </li>
    </ul>

    <h2 id="servicio" class="text-h6">3. El servicio</h2>
    <ul>
      <li>
        Servify POS es un sistema de gestión en línea, por suscripción, para pequeños negocios en Colombia: pedidos y
        mesas, caja, inventario y kardex, recetas y costos, clientes y proveedores, facturación de cuotas, cartera,
        gastos, finanzas e informes, y la app de meseros para tomar pedidos desde la mesa.
      </li>
      <li>El negocio usa los módulos que contrató, con los límites de su plan, según las condiciones comerciales.</li>
      <li>
        El servicio funciona por internet: el panel necesita un navegador actualizado y la app de meseros, un teléfono
        Android con la app instalada desde Google Play. Sin conexión no se pueden enviar pedidos ni registrar cobros.
      </li>
      <li>
        Servify POS mejora el servicio de forma continua y puede publicar cambios en cualquier momento, sin costo
        adicional. Si un cambio quita un módulo o una función esencial que el negocio usa, Servify POS lo avisará con
        al menos {{ TERMS.noticeDays }} días de anticipación y el negocio podrá terminar el contrato con la devolución
        de la parte no usada del periodo pagado.
      </li>
      <li>
        Las plantillas de catálogo y los datos de ejemplo son un punto de partida: el negocio revisa y ajusta precios,
        impuestos, recetas y existencias antes de usarlos.
      </li>
    </ul>

    <h2 id="cuentas" class="text-h6">4. Cuentas, usuarios y seguridad</h2>
    <ul>
      <li>
        Servify POS crea la cuenta del negocio y la de su primer administrador. El administrador crea las cuentas de
        sus empleados, les asigna permisos y puede desactivarlas en cualquier momento.
      </li>
      <li>
        Las cuentas son personales: cada usuario tiene la suya y no la comparte. El negocio responde por lo que se haga
        con las cuentas de sus usuarios y por los permisos que les asigna.
      </li>
      <li>Las cuentas de usuario deben ser de personas mayores de edad.</li>
      <li>
        Las contraseñas son confidenciales. Si el negocio sospecha que alguien usó una cuenta sin autorización, debe
        cambiar la contraseña o desactivar al usuario y avisar de inmediato a Servify POS en
        <a :href="mailto">{{ OWNER.email }}</a>.
      </li>
      <li>Servify POS nunca pide contraseñas por correo, teléfono ni mensaje.</li>
    </ul>

    <h2 id="precio-y-pagos" class="text-h6">5. Periodo de prueba, precio y pagos</h2>
    <ul>
      <li>
        <strong>Prueba gratis.</strong> Un negocio nuevo puede usar el servicio sin costo durante
        {{ TERMS.trialDays }} días, o el plazo que se acuerde. Al terminar la prueba no se hace ningún cobro
        automático: para seguir usando el servicio, el negocio paga el primer periodo. Si no paga, se aplica la
        sección 6.
      </li>
      <li>
        <strong>Valor.</strong> El valor mensual es el de las condiciones comerciales, con los impuestos incluidos, si
        los hay.
      </li>
      <li>
        <strong>Pago anticipado.</strong> Se paga por anticipado, por uno o varios meses, por transferencia, en
        efectivo o por el medio que se acuerde. Servify POS registra el pago y el servicio queda pagado hasta la fecha
        que corresponda. No hay débitos automáticos y Servify POS no guarda datos de tarjetas ni de cuentas bancarias
        del negocio.
      </li>
      <li>
        <strong>Soporte del pago.</strong> Servify POS entrega por cada pago el comprobante o documento que exija la ley
        tributaria.
      </li>
      <li>
        <strong>Cambios de precio.</strong> Servify POS puede cambiar el valor mensual avisando por correo con al menos
        {{ TERMS.noticeDays }} días de anticipación. El valor nuevo aplica desde el primer periodo que empiece después
        de ese plazo; los periodos ya pagados conservan su valor. Si el negocio no está de acuerdo, puede terminar el
        contrato antes de que el cambio aplique.
      </li>
      <li>
        <strong>Devoluciones.</strong> Lo pagado por un periodo ya iniciado no se devuelve, salvo en los casos de las
        secciones 3, 13 y 14, en los que Servify POS devuelve la parte proporcional no usada.
      </li>
    </ul>

    <h2 id="solo-lectura" class="text-h6">6. Pago vencido y modo de solo lectura</h2>
    <ul>
      <li>
        Si termina el periodo pagado, o la prueba, sin un pago nuevo, el negocio tiene {{ TERMS.graceDays }} días de
        gracia, o los que se acuerden, con el servicio completo. El panel y la app de meseros muestran cuántos días
        quedan.
      </li>
      <li>
        Al terminar la gracia, la cuenta pasa a <strong>solo lectura</strong>: los usuarios pueden entrar, consultar y
        exportar la información, pero no crear ni modificar nada. Eso incluye tomar pedidos desde la app, cobrar,
        registrar gastos y mover el inventario.
      </li>
      <li>El servicio se reactiva, sin perder información, cuando Servify POS registra el pago.</li>
      <li>
        Si la cuenta sigue en solo lectura durante {{ TERMS.readOnlyDaysBeforeTermination }} días, Servify POS puede
        terminar el contrato avisando por correo con al menos 15 días de anticipación (sección 13).
      </li>
    </ul>

    <h2 id="informacion-y-datos" class="text-h6">7. La información del negocio y los datos personales</h2>
    <ul>
      <li>
        <strong>Es del negocio.</strong> La información que el negocio y sus usuarios registran (productos, precios,
        pedidos, ventas, clientes, proveedores, gastos, inventario, imágenes y logo) es del negocio. Servify POS solo la
        usa para prestarle el servicio: guardarla, organizarla, calcular con ella, mostrarla, imprimirla, exportarla y
        respaldarla. No la vende, no la cede y no la usa para fines propios.
      </li>
      <li>
        <strong>Copia.</strong> El negocio puede descargar su información en cualquier momento, incluso en solo
        lectura, con las exportaciones a Excel y PDF del panel, y pedirle a Servify POS un archivo con todos los datos
        de su negocio.
      </li>
      <li>
        <strong>Papeles frente a los datos personales.</strong> De los datos personales que el negocio registra sobre
        sus clientes, pagadores, proveedores y empleados, el negocio es el responsable del tratamiento y Servify POS es
        su encargado, como explica la <a :href="`${policyHref}#papel`">sección 2 de la política de privacidad</a>.
        Esta sección es el contrato de transmisión de datos personales entre los dos (art. 2.2.2.25.5.2 del Decreto
        1074 de 2015).
      </li>
      <li>
        <strong>Alcance y actividades del encargado.</strong> Servify POS trata esos datos solo por cuenta del negocio
        y según sus instrucciones, para: recogerlos a través del servicio cuando los usuarios los escriben o los cargan
        desde Excel; almacenarlos y respaldarlos; organizarlos, mostrarlos, calcular con ellos, imprimirlos y
        exportarlos; moverlos entre bases de datos del propio servicio cuando hace falta para operarlo; dar soporte; y
        actualizarlos, rectificarlos o suprimirlos cuando el negocio lo pida o la ley lo exija.
      </li>
      <li>
        <strong>Obligaciones de Servify POS como encargado:</strong>
        <ol>
          <li>
            tratar los datos a nombre del negocio, conforme a los principios de la Ley 1581 de 2012 y a la finalidad
            que los titulares autorizaron al negocio;
          </li>
          <li>
            salvaguardar la seguridad de las bases de datos con las medidas de la
            <a :href="`${policyHref}#seguridad`">sección 11 de la política de privacidad</a>;
          </li>
          <li>
            guardar confidencialidad sobre los datos y su tratamiento, también después de terminado el contrato, y
            exigirla a quien acceda a ellos por su cuenta;
          </li>
          <li>
            aplicar la política de tratamiento de la información del negocio en lo que corresponda a sus actividades
            como encargado;
          </li>
          <li>
            actualizar, rectificar o suprimir la información que el negocio le reporte dentro de los 5 días hábiles
            siguientes a su recibo (art. 18 de la Ley 1581 de 2012);
          </li>
          <li>
            trasladar al negocio, en máximo 2 días hábiles, las consultas y reclamos de los titulares que le lleguen,
            y apoyarlo para responderlos;
          </li>
          <li>avisar al negocio sin demora de cualquier incidente de seguridad que afecte sus datos;</li>
          <li>
            usar solo los subencargados de la
            <a :href="`${policyHref}#con-quien-se-comparten`">sección 9 de la política de privacidad</a>, que el
            negocio autoriza con estos términos, junto con la transmisión internacional que explica su sección 10, y
            avisar por correo antes de agregar o cambiar un subencargado;
          </li>
          <li>
            al terminar el contrato, entregar la copia de la información que el negocio pida y suprimirla en los plazos
            de la <a :href="`${policyHref}#conservacion`">sección 12 de la política de privacidad</a>.
          </li>
        </ol>
      </li>
      <li>
        <strong>Obligaciones del negocio como responsable:</strong> obtener y conservar la autorización de sus
        clientes, pagadores, proveedores y empleados para tratar sus datos; tener su propia política de tratamiento de
        la información y atender las solicitudes de esos titulares; registrar solo los datos que necesita; no registrar
        datos sensibles, como información de salud, en notas y otros campos de texto libre; no subir fotos de personas
        ni de documentos, porque las imágenes se ven con su enlace; y respetar las reglas sobre datos de menores de edad
        de la <a :href="`${policyHref}#datos-sensibles`">sección 7 de la política de privacidad</a>.
      </li>
    </ul>

    <h2 id="obligaciones-del-negocio" class="text-h6">8. Lo que el servicio no hace por el negocio</h2>
    <ul>
      <li>
        <strong>Facturación electrónica.</strong> Servify POS no es proveedor tecnológico de facturación electrónica:
        no expide ni transmite a la DIAN facturas electrónicas ni documentos equivalentes electrónicos. Los documentos
        que imprime el servicio (tirilla POS, factura de venta con la numeración de la resolución que registra el
        negocio, cuenta de cobro y recibo de caja) se generan con los datos que el negocio configura. Decidir qué
        documento debe expedir y cumplir el régimen de facturación es responsabilidad del negocio.
      </li>
      <li>
        <strong>Precios, impuestos y propinas.</strong> El negocio configura sus precios, impuestos, medios de pago y la
        propina sugerida, y responde por que sean correctos y legales, incluidas las reglas de la propina voluntaria
        (Ley 1935 de 2018).
      </li>
      <li>
        <strong>Contabilidad.</strong> Los informes, el estado de resultados y los registros contables que genera el
        servicio son herramientas de gestión: no reemplazan la contabilidad oficial del negocio ni el concepto de un
        contador público.
      </li>
      <li>
        <strong>Conservación.</strong> Conservar los libros y papeles del comerciante durante 10 años (art. 28 de la Ley
        962 de 2005) es obligación del negocio, que debe descargar su información antes de que se elimine.
      </li>
      <li>
        <strong>Cálculos.</strong> El servicio calcula con los datos que registra el negocio (precios, recetas, costos,
        existencias y tarifas por tiempo). El negocio revisa sus cifras: un dato errado produce resultados errados.
      </li>
    </ul>

    <h2 id="reglas-de-uso" class="text-h6">9. Reglas de uso</h2>
    <p>El negocio y sus usuarios se comprometen a no:</p>
    <ul>
      <li>usar el servicio para actividades ilegales o para registrar información obtenida ilegalmente;</li>
      <li>intentar entrar a cuentas o datos de otros negocios, o a funciones que su cuenta no tiene permitidas;</li>
      <li>
        probar, escanear o atacar la seguridad del servicio sin autorización escrita de Servify POS (quien encuentre una
        vulnerabilidad debe reportarla a <a :href="mailto">{{ OWNER.email }}</a>);
      </li>
      <li>copiar, descompilar o aplicar ingeniería inversa al software, salvo en lo que la ley lo permita;</li>
      <li>sobrecargar el servicio o extraer información de forma automatizada, fuera de las funciones del panel;</li>
      <li>revender, sublicenciar o dar acceso al servicio a personas distintas de sus usuarios;</li>
      <li>
        subir programas maliciosos o contenido que infrinja derechos de terceros, como imágenes sin permiso de su autor.
      </li>
    </ul>
    <p>
      Si un uso pone en riesgo el servicio, a otros negocios o a terceros, Servify POS puede suspender el acceso de
      inmediato (sección 13).
    </p>

    <h2 id="propiedad-intelectual" class="text-h6">10. Propiedad intelectual</h2>
    <ul>
      <li>
        El software, el diseño, la documentación y la marca Servify POS son de Servify POS o de sus licenciantes.
        Mientras la suscripción esté vigente, el negocio tiene una licencia de uso no exclusiva e intransferible, para su
        propia operación. Estos términos no le transfieren ninguna propiedad sobre el servicio.
      </li>
      <li>
        La información, el logo y las imágenes del negocio siguen siendo suyos. El negocio autoriza a Servify POS a
        alojarlos, procesarlos y mostrarlos solo para prestarle el servicio; por ejemplo, las imágenes del menú se
        muestran a quien tenga su enlace.
      </li>
      <li>
        Servify POS puede usar las sugerencias que el negocio le envíe para mejorar el servicio, sin obligación de pago.
      </li>
    </ul>

    <h2 id="disponibilidad" class="text-h6">11. Disponibilidad, respaldos y soporte</h2>
    <ul>
      <li>
        Servify POS procura que el servicio esté disponible todo el tiempo, pero no garantiza que funcione sin
        interrupciones ni errores. Puede haber pausas por mantenimiento o actualizaciones, que se procuran hacer en
        horas de poco uso, y fallas de internet o de los proveedores de infraestructura (sección 9 de la política de
        privacidad) que no dependen de Servify POS.
      </li>
      <li>
        La base de datos se respalda como explica la sección 11 de la política de privacidad. Aun así, el negocio debe
        descargar periódicamente la información que necesite conservar.
      </li>
      <li>
        El soporte se presta por correo a <a :href="mailto">{{ OWNER.email }}</a>, en días hábiles. Para resolver una
        solicitud, Servify POS puede consultar los datos del negocio, solo en lo necesario.
      </li>
    </ul>

    <h2 id="responsabilidad" class="text-h6">12. Responsabilidad</h2>
    <ul>
      <li>
        Servify POS responde por los daños directos que cause al negocio por incumplir estos términos. Salvo dolo o
        culpa grave (arts. 63 y 1522 del Código Civil), esa responsabilidad tiene como límite total lo que el negocio
        pagó por el servicio en los {{ TERMS.liabilityMonths }} meses anteriores al hecho que la origina.
      </li>
      <li>
        Salvo dolo o culpa grave, Servify POS no responde por el lucro cesante ni por otros daños indirectos; por lo que
        resulte de la información, la configuración o las decisiones del negocio y de sus usuarios; por lo que se haga
        con una cuenta y su contraseña; ni por fallas de internet, de los equipos del negocio o de los proveedores de
        infraestructura, ni por fuerza mayor o caso fortuito (art. 64 del Código Civil).
      </li>
      <li>
        El negocio responde por la información que registra, por los actos de sus usuarios y por el cumplimiento de sus
        obligaciones legales (sección 8), y mantendrá indemne a Servify POS frente a los reclamos de terceros que se
        originen en ellos.
      </li>
      <li>Nada de esta sección limita derechos que la ley no permita limitar.</li>
    </ul>

    <h2 id="terminacion" class="text-h6">13. Duración y terminación</h2>
    <ul>
      <li>El contrato es por tiempo indefinido, en periodos mensuales, y no tiene cláusula de permanencia.</li>
      <li>
        <strong>El negocio</strong> puede terminarlo cuando quiera, sin penalidad: basta con no pagar el periodo
        siguiente o escribir a <a :href="mailto">{{ OWNER.email }}</a>. Pedir la eliminación de los datos del negocio
        (<a :href="`${policyHref}#eliminacion`">sección 13 de la política de privacidad</a>) también lo termina.
      </li>
      <li>
        <strong>Servify POS</strong> puede terminarlo:
        <ul>
          <li>
            sin causa, avisando por correo con al menos {{ TERMS.noticeDays }} días de anticipación y devolviendo la
            parte no usada del periodo pagado;
          </li>
          <li>por falta de pago, en el caso de la sección 6;</li>
          <li>
            de inmediato, o suspender antes el acceso, si el negocio o sus usuarios incumplen gravemente las reglas de
            uso, si lo ordena una autoridad o si hace falta para proteger la seguridad del servicio o de otros negocios.
            Servify POS informará el motivo por correo.
          </li>
        </ul>
      </li>
      <li>
        <strong>Al terminar,</strong> se cierra el acceso de los usuarios. El negocio puede pedir la copia de su
        información (sección 7) y los datos se eliminan en los plazos de la sección 12 de la política de privacidad. Se
        conservan los registros de la suscripción y de los pagos, por obligación contable.
      </li>
      <li>Las secciones 7, 10, 12 y 16 siguen vigentes después de la terminación en lo que corresponda.</li>
    </ul>

    <h2 id="cambios" class="text-h6">14. Cambios a estos términos</h2>
    <ul>
      <li>
        Servify POS puede cambiar estos términos. Cada versión se publica en esta misma dirección, con su número y su
        fecha.
      </li>
      <li>
        Los cambios sustanciales se avisan por correo a los administradores y con un aviso en el panel, con al menos
        {{ TERMS.noticeDays }} días de anticipación, salvo que una ley o una autoridad obligue a aplicarlos antes. Si el
        negocio no está de acuerdo, puede terminar el contrato antes de que el cambio aplique, con la devolución de la
        parte no usada del periodo pagado. Seguir usando el servicio después de esa fecha es aceptar la versión nueva.
      </li>
      <li>
        Los cambios a la política de privacidad siguen las reglas de su
        <a :href="`${policyHref}#cambios`">sección 17</a>.
      </li>
    </ul>

    <h2 id="comunicaciones" class="text-h6">15. Comunicaciones</h2>
    <ul>
      <li>
        Servify POS se comunica con el negocio por el correo de sus administradores registrado en el servicio y con
        avisos en el panel y en la app. El negocio mantiene ese correo al día en Configuración.
      </li>
      <li>
        El negocio se comunica con Servify POS por correo a <a :href="mailto">{{ OWNER.email }}</a> o por escrito a
        {{ OWNER.address }}.
      </li>
      <li>
        Los mensajes de datos, como los correos electrónicos, tienen plena validez entre las partes (Ley 527 de 1999).
      </li>
    </ul>

    <h2 id="ley-aplicable" class="text-h6">16. Ley aplicable y controversias</h2>
    <ul>
      <li>Estos términos se rigen por las leyes de la República de Colombia.</li>
      <li>
        Las partes intentarán resolver cualquier diferencia de forma directa durante 30 días contados desde que una de
        ellas la comunique por escrito. Si no lo logran, cualquiera puede acudir a los jueces competentes de Colombia
        según las reglas del Código General del Proceso.
      </li>
    </ul>

    <h2 id="disposiciones-generales" class="text-h6">17. Disposiciones generales</h2>
    <ul>
      <li>
        Estos términos, las condiciones comerciales y la política de privacidad son todo el acuerdo entre las partes
        sobre el servicio. Si se contradicen, prevalecen las condiciones comerciales en lo que regulan (plan, módulos,
        límites, valor y plazos) y la política de privacidad en lo relativo a los datos personales.
      </li>
      <li>Si una cláusula resulta inválida, las demás siguen vigentes.</li>
      <li>Que una parte no exija un derecho en un momento dado no significa que renuncie a él.</li>
      <li>
        El negocio no puede ceder este contrato sin autorización escrita de Servify POS. Servify POS puede cederlo a una
        sociedad que constituya o que continúe prestando el servicio, avisando por correo con al menos
        {{ TERMS.noticeDays }} días de anticipación; si el negocio no está de acuerdo, puede terminarlo antes de la
        cesión.
      </li>
    </ul>

    <h2 id="google-play" class="text-h6">18. Google Play</h2>
    <p>
      La app de meseros se descarga desde Google Play, sujeta a los términos de Google Play. Google no es parte de estos
      términos ni responde por el servicio: las solicitudes sobre la app se dirigen a Servify POS.
    </p>
  </LegalPage>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import LegalPage from '@/components/LegalPage.vue'
import { OWNER, PUBLIC_SITE as SITE } from '@/utils/branding'

/**
 * The commercial periods the terms promise: change them here and nowhere
 * else. `trialDays` and `graceDays` are the backend defaults (`trial_days` in
 * Platform\CompanyController, `subscriptions.grace_days`); Plataforma can
 * agree others per business, which the text allows.
 */
const TERMS = {
  version: '1.0',
  effectiveDate: '5 de noviembre de 2026',
  trialDays: 15,
  graceDays: 7,
  readOnlyDaysBeforeTermination: 90,
  liabilityMonths: 3,
  noticeDays: 30,
}

const mailto = `mailto:${OWNER.email}`
const policyHref = useRouter().resolve('/privacidad').href
</script>
