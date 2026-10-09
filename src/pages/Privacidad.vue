<template>
  <div class="bg-background py-4 py-md-10 px-2 px-sm-4">
    <v-sheet tag="article" max-width="760" rounded="lg" border class="policy text-body-1 mx-auto pa-5 pa-md-10">
      <header class="mb-8">
        <router-link to="/login" class="d-inline-flex align-center ga-2 text-decoration-none text-high-emphasis mb-6">
          <img :src="APP_ICON" alt="" width="32" height="32" />
          <span class="text-subtitle-1 font-weight-bold">{{ APP_NAME }}</span>
        </router-link>
        <h1 class="text-h4 mb-1">Política de privacidad</h1>
        <p class="text-h6 text-medium-emphasis">y de tratamiento de datos personales de Servify POS</p>
        <p class="text-body-2 text-medium-emphasis">
          Versión {{ POLICY.version }}. Fecha de entrada en vigencia: {{ POLICY.effectiveDate }}.
        </p>
      </header>

      <p>
        Esta política explica qué datos personales se tratan en Servify POS, para qué, con quién se comparten,
        cómo se protegen, cuánto tiempo se conservan y cómo se ejercen los derechos sobre ellos, incluida la
        eliminación de la cuenta. Aplica a:
      </p>
      <ul>
        <li>el panel web de gestión, en <a :href="SITE">{{ SITE }}</a>;</li>
        <li>la aplicación Android para meseros "Servify POS" (paquete com.servifypos.app), distribuida en Google Play;</li>
        <li>la API que usan ambos, en https://api.servifypos.com.</li>
      </ul>

      <h2 id="responsable" class="text-h6">1. Responsable del tratamiento</h2>
      <ul>
        <li>
          Nombre: {{ POLICY.ownerName }}, persona natural, identificada con cédula de ciudadanía {{ POLICY.ownerId }},
          quien presta el servicio bajo la marca Servify POS y publica la aplicación en Google Play.
        </li>
        <li>Domicilio: {{ POLICY.city }}, Colombia.</li>
        <li>Dirección: {{ POLICY.address }}.</li>
        <li>Correo electrónico: <a :href="mailto">{{ POLICY.email }}</a>.</li>
        <li>Teléfono: {{ POLICY.phone }}.</li>
        <li>Política publicada en: <a :href="`${SITE}/privacidad`">{{ SITE }}/privacidad</a></li>
      </ul>
      <p>En adelante, "Servify POS" se refiere a esta persona, en el papel que corresponda según la sección 2.</p>

      <h2 id="papel" class="text-h6">2. Qué es Servify POS y en qué papel trata los datos</h2>
      <p>
        Servify POS es un sistema de gestión por suscripción para pequeños negocios en Colombia (restaurantes,
        panaderías, billares, conjuntos residenciales, parqueaderos y similares): pedidos y mesas, caja, inventario,
        clientes y proveedores, facturación de cuotas, cartera, gastos e informes. Cada negocio que contrata el
        servicio es un "negocio cliente".
      </p>
      <p>Servify POS cumple dos papeles distintos frente a los datos:</p>
      <ul>
        <li>
          <strong>Responsable</strong> de los datos de cuenta, acceso y seguridad de las personas que usan Servify POS
          (personal de la plataforma, administradores y empleados de los negocios clientes) y de los datos de la
          relación comercial con cada negocio cliente (suscripción, pagos y contacto). Servify POS decide para qué y
          cómo se tratan esos datos.
        </li>
        <li>
          <strong>Encargado</strong> de los datos que cada negocio cliente registra en el sistema sobre sus propios
          clientes, pagadores, proveedores y empleados durante su operación (pedidos, cobros, cartera, recibos de caja,
          gastos, cierres de caja). De esos datos el <strong>responsable es el negocio cliente</strong>: decide qué
          registra y para qué, debe contar con la autorización de esas personas y es quien atiende primero sus
          solicitudes. Servify POS los trata solo por cuenta del negocio, para prestarle el servicio, según sus
          instrucciones, los términos del servicio y esta política, y no los usa para fines propios.
        </li>
      </ul>
      <p>
        La Ley 1581 de 2012 protege a las personas naturales. Los datos de un negocio que es persona natural (por
        ejemplo, su NIT, que contiene su número de cédula) y los de las personas de contacto de cualquier negocio sí
        son datos personales y se tratan como tales.
      </p>

      <h2 id="datos" class="text-h6">3. Datos que se tratan</h2>

      <h3 id="datos-usuarios" class="text-subtitle-1 font-weight-bold">3.1 Usuarios de Servify POS (Servify POS es responsable)</h3>
      <ul>
        <li>
          Identificación de la cuenta: nombre; correo electrónico (obligatorio para administradores y personal de
          plataforma, opcional para empleados); nombre de usuario (empleados, único dentro de cada negocio); teléfono
          (opcional); rol; permisos; negocio al que pertenece; estado activo o desactivado.
        </li>
        <li>
          Credenciales: la contraseña se guarda solo como huella criptográfica (hash), nunca en texto. Para la cuenta de
          plataforma, el secreto de verificación en dos pasos se guarda cifrado y los códigos de respaldo como huella.
        </li>
        <li>
          Sesiones: un identificador de sesión guardado como huella, el tipo de dispositivo (web o móvil), la fecha de
          último uso y la de vencimiento; la fecha del último ingreso; los enlaces de cambio de contraseña (válidos 60
          minutos y de un solo uso).
        </li>
        <li>
          Prueba de la autorización: la versión de esta política que la persona aceptó, la fecha y hora de la
          aceptación, la dirección IP y el navegador o la aplicación desde los que la aceptó (sección 8).
        </li>
      </ul>

      <h3 id="datos-negocios" class="text-subtitle-1 font-weight-bold">3.2 Negocios clientes y relación comercial (Servify POS es responsable)</h3>
      <ul>
        <li>
          Datos del negocio: nombre, código del negocio (identificador con el que se entra desde la app), correo y
          teléfono de contacto, tipo de negocio y módulos contratados.
        </li>
        <li>
          Datos que el negocio registra en "Datos del negocio" para sus documentos impresos: NIT, razón social, nombre
          comercial, dirección, ciudad, departamento, código postal, teléfono, correo, actividad económica (CIIU),
          régimen tributario, resolución de facturación de la DIAN, observaciones al pie y logo.
        </li>
        <li>
          Suscripción: plan, valor mensual acordado, estado, fechas de vigencia, pagos registrados (valor, fecha, medio,
          referencia y notas) y el asesor comercial asignado.
        </li>
        <li>Asesores comerciales de Servify POS: nombre, correo y teléfono.</li>
        <li>Mensajes de soporte y solicitudes enviadas por correo.</li>
      </ul>

      <h3 id="datos-de-cada-negocio" class="text-subtitle-1 font-weight-bold">3.3 Datos que registra cada negocio cliente (Servify POS es encargado)</h3>
      <ul>
        <li>
          <strong>Clientes y pagadores:</strong> nombre; tipo y número de documento (CC, NIT, CE, pasaporte, TI, PEP,
          DIE o NUIP); tipo de persona (natural o jurídica); nombre comercial; correo; teléfono; dirección; ciudad;
          departamento; código postal; régimen y responsabilidades tributarias; si es cliente frecuente; notas. Para la
          facturación de cuotas: cuota mensual, día de corte, concepto e impuesto. El negocio puede cargarlos a mano o
          desde un archivo de Excel.
        </li>
        <li>
          <strong>Proveedores:</strong> nombre, número de documento, teléfono, correo, dirección y notas, y el nombre del
          proveedor o tercero en compras, gastos y movimientos de inventario.
        </li>
        <li>
          <strong>Pedidos y cobros:</strong> mesa, productos, valores, propina, descuentos y su motivo, medio de pago y
          número de factura o tiquete. Si el negocio los escribe: nombre, teléfono, correo y dirección del cliente (por
          ejemplo, para domicilios), nombres de las personas de la mesa para dividir la cuenta, notas e instrucciones
          especiales.
        </li>
        <li>
          <strong>Facturación de cuotas, cartera y recibos de caja:</strong> cuentas de cobro y facturas con una copia de
          los datos del pagador al momento de emitirlas, abonos, saldos pendientes y vencidos, y recibos de caja (RC).
          Servify POS no reporta estos saldos a centrales de riesgo.
        </li>
        <li>
          <strong>Gastos y movimientos de dinero:</strong> concepto, valor, fecha, medio de pago, número de factura y
          nombre del proveedor; aportes, retiros y préstamos con su concepto.
        </li>
        <li>
          <strong>Caja:</strong> turnos, conteos, diferencias, notas de apertura y cierre, y la trazabilidad de las
          correcciones (quién, cuándo y por qué).
        </li>
        <li>
          <strong>Empleados del negocio, en su operación:</strong> permisos asignados y actividad atribuida a cada
          usuario (quién abrió o cobró un pedido, registró un gasto o un abono, abrió, cerró o corrigió un turno de caja).
        </li>
        <li><strong>Imágenes:</strong> fotos de productos, categorías y menú, y el logo del negocio.</li>
      </ul>

      <h3 id="datos-tecnicos" class="text-subtitle-1 font-weight-bold">3.4 Datos técnicos y de seguridad (Servify POS es responsable)</h3>
      <ul>
        <li>
          La dirección IP y el usuario o correo con que se intenta iniciar sesión, que se usan durante un minuto para
          bloquear intentos fallidos repetidos. Aparte de la prueba de la autorización (sección 3.1), la aplicación no
          guarda un historial de direcciones IP asociado a cada cuenta.
        </li>
        <li>
          Registros técnicos de la API y de los proveedores de infraestructura: fecha y hora, dirección IP, dirección
          solicitada, navegador o sistema operativo y errores. Se usan para operar el servicio, diagnosticar fallas y
          protegerlo.
        </li>
      </ul>

      <h3 id="lo-que-no-se-trata" class="text-subtitle-1 font-weight-bold">3.5 Lo que Servify POS no trata</h3>
      <ul>
        <li>
          No accede a la ubicación, los contactos, la cámara, el micrófono, las fotos o archivos del teléfono, los SMS
          ni el registro de llamadas.
        </li>
        <li>
          No incluye herramientas de publicidad ni de analítica de terceros, no usa el identificador de publicidad del
          dispositivo, no crea perfiles y no vende ni alquila datos.
        </li>
        <li>
          No procesa pagos con tarjeta ni guarda números de tarjetas o cuentas bancarias: el medio de pago se registra
          solo como categoría (efectivo, tarjeta, transferencia, Nequi, Daviplata u otro).
        </li>
        <li>No solicita datos sensibles (sección 7).</li>
      </ul>

      <h2 id="app-android" class="text-h6">4. Aplicación Android para meseros</h2>
      <ul>
        <li>
          <strong>Para qué sirve:</strong> iniciar sesión con el código del negocio, el usuario y la contraseña; ver las
          mesas; tomar y enviar pedidos; y seguir su estado.
        </li>
        <li>
          <strong>Cuentas:</strong> la app no permite crear cuentas. El administrador del negocio crea las de sus
          empleados desde el panel web.
        </li>
        <li>
          <strong>Qué envía a la API:</strong> al iniciar sesión, el código del negocio, el usuario o correo y la
          contraseña; al pedir, la mesa, los productos, las cantidades, las variantes, las notas y, si el mesero los
          escribe, los nombres de las personas de la mesa.
        </li>
        <li>
          <strong>Qué guarda en el teléfono:</strong>
          <ul>
            <li>el token de sesión, en el almacenamiento seguro de Android (Keystore);</li>
            <li>
              los datos del usuario que inició sesión (nombre, usuario o correo, teléfono, rol, permisos y negocio) y el
              código del negocio, en el almacenamiento privado de la app.
            </li>
          </ul>
          Al cerrar sesión se borran el token y los datos del usuario; el código del negocio se conserva para no tener
          que escribirlo de nuevo. Desinstalar la app borra todo. Si el usuario tiene activada la copia de seguridad de
          Android, el sistema puede incluir en ella el almacenamiento privado de la app.
        </li>
        <li>
          <strong>Duración de la sesión:</strong> no vence durante el turno. Se cierra al cerrar sesión, cuando el
          administrador desactiva al usuario o cuando el negocio queda inactivo, y también tras 30 días sin uso.
        </li>
        <li>
          <strong>Permisos:</strong> la app no solicita permisos de ubicación, contactos, cámara, micrófono, archivos ni
          notificaciones. Solo usa la conexión a internet.
        </li>
        <li>
          <strong>Actualizaciones:</strong> la app puede descargar actualizaciones de su código mediante el servicio EAS
          Update de Expo. Para eso el teléfono consulta los servidores de Expo y envía datos técnicos: sistema operativo,
          versión de la app, canal de actualización y un identificador aleatorio de la instalación, que no identifica a
          la persona ni al aparato. Como en cualquier conexión, Expo también recibe la dirección IP.
        </li>
        <li>
          <strong>Distribución:</strong> Google Play distribuye la app y trata los datos de descarga e instalación como
          responsable independiente, según su propia política de privacidad. Servify POS recibe de Google Play
          estadísticas agregadas e informes técnicos de fallos de los usuarios que comparten diagnósticos con Google.
        </li>
      </ul>

      <h2 id="panel-web" class="text-h6">5. Panel web: almacenamiento local y cookies</h2>
      <ul>
        <li>
          El panel guarda en el almacenamiento local del navegador (localStorage) el token de sesión, los datos del
          usuario que inició sesión (los mismos que en la app) y las preferencias de caja (propina e impresión). Al
          cerrar sesión se borran el token y los datos del usuario.
        </li>
        <li>La sesión web vence a las 4:00 a. m. del día siguiente al ingreso.</li>
        <li>
          El panel no usa cookies propias ni cookies de publicidad, analítica o redes sociales, y no carga scripts de
          terceros: las fuentes y los íconos se sirven desde el mismo sitio.
        </li>
        <li>
          Cloudflare, que entrega el sitio, puede usar cookies técnicas estrictamente necesarias para proteger el sitio
          de ataques.
        </li>
        <li>Para borrar estos datos basta con cerrar sesión o borrar los datos del sitio en el navegador.</li>
      </ul>

      <h2 id="finalidades" class="text-h6">6. Finalidades</h2>
      <p>Como responsable, Servify POS trata los datos para:</p>
      <ol>
        <li>
          Crear y administrar cuentas, autenticar a los usuarios, mantener sus sesiones, recuperar contraseñas por correo
          y aplicar la verificación en dos pasos.
        </li>
        <li>Prestar el servicio contratado y dar acceso a cada usuario solo a los módulos que tiene permitidos.</li>
        <li>
          Gestionar la suscripción: estados, avisos de vencimiento, bloqueo por falta de pago, registro de pagos y
          asignación del asesor comercial.
        </li>
        <li>
          Enviar correos transaccionales, como el enlace para definir o cambiar la contraseña. Servify POS no envía
          publicidad; si algún día lo hace, pedirá una autorización previa y separada.
        </li>
        <li>Dar soporte técnico y atender solicitudes.</li>
        <li>
          Proteger el servicio: prevenir accesos indebidos, fraudes y abusos, investigar incidentes, hacer respaldos y
          recuperar la información.
        </li>
        <li>
          Cumplir obligaciones legales, contables y tributarias y atender requerimientos de autoridades competentes.
        </li>
        <li>
          Mantener y mejorar el servicio con información técnica (errores y rendimiento), sin crear perfiles de las
          personas.
        </li>
      </ol>
      <p>Como encargado, Servify POS trata los datos de cada negocio cliente solo para:</p>
      <ol>
        <li>
          Guardar, organizar, mostrar, calcular, imprimir y exportar (Excel y PDF) la información que el negocio
          registra: pedidos, caja, inventario, facturación de cuotas, cartera, recibos de caja, gastos e informes.
        </li>
        <li>
          Mover o copiar los datos del negocio entre bases de datos del propio servicio cuando hace falta para operarlo,
          o cuando el negocio lo pide.
        </li>
        <li>Dar soporte cuando el negocio lo pide o cuando es necesario para resolver una falla.</li>
      </ol>

      <h2 id="datos-sensibles" class="text-h6">7. Datos sensibles, imágenes y menores de edad</h2>
      <ul>
        <li>
          <strong>Datos sensibles.</strong> Servify POS no solicita datos sensibles, es decir, los que afectan la
          intimidad o pueden generar discriminación: origen racial o étnico, orientación política, convicciones
          religiosas o filosóficas, afiliación sindical, salud, vida sexual o datos biométricos (art. 5 de la Ley 1581 de
          2012). Los números de documento son datos personales, no sensibles; aun así, solo los ven los usuarios
          autorizados del negocio y no se publican.
        </li>
        <li>
          <strong>Campos de texto libre.</strong> Las notas, instrucciones especiales, observaciones y nombres de las
          personas de la mesa no deben usarse para registrar datos sensibles, como información de salud o alergias de
          una persona identificada. Si un negocio lo hace, lo hace bajo su responsabilidad y debe contar con la
          autorización explícita del titular (art. 6 de la Ley 1581 de 2012).
        </li>
        <li>
          <strong>Imágenes.</strong> Las imágenes que suben los negocios deben ser de productos, categorías, menú o el
          logo. Se publican en un almacenamiento accesible para cualquiera que tenga el enlace, porque la web y la app
          las cargan directamente por ese enlace, así que no deben subirse fotos de personas ni de documentos. Al
          subirlas se reducen y se vuelven a codificar, lo que elimina metadatos como la ubicación GPS de la foto.
        </li>
        <li>
          <strong>Menores de edad.</strong> Servify POS está dirigido a negocios y a sus empleados; no está dirigido a
          niños, niñas ni adolescentes y las cuentas de usuario deben ser de personas mayores de edad. Si un negocio
          registra datos de un menor (por ejemplo, un pagador con tarjeta de identidad), el negocio es responsable de
          ese tratamiento y debe contar con la autorización de su representante legal y respetar su interés superior
          (art. 7 de la Ley 1581 de 2012 y art. 2.2.2.25.2.9 del Decreto 1074 de 2015). Si Servify POS advierte datos de
          un menor tratados sin esos requisitos, avisará al negocio y los suprimirá según sus instrucciones.
        </li>
      </ul>

      <h2 id="autorizacion" class="text-h6">8. Autorización</h2>
      <ul>
        <li>
          <strong>Usuarios de Servify POS.</strong> La autorización para tratar los datos descritos en las secciones
          3.1, 3.2 y 3.4 se otorga al aceptar esta política. La primera vez que una persona inicia sesión en el panel
          web o en la app, y de nuevo cada vez que se publica una versión nueva, Servify POS le muestra un resumen con el
          enlace a esta política y le pide marcar la casilla "Leí y acepto la política de privacidad y tratamiento de
          datos personales"; sin aceptarla no puede seguir usando el panel ni la app. Servify POS conserva prueba de
          cada aceptación: usuario, versión aceptada, fecha y hora, dirección IP y navegador o aplicación. Los
          administradores también la otorgan al aceptar los términos del servicio cuando contratan. El negocio que crea
          la cuenta de un empleado debe informarle esta política.
        </li>
        <li>
          <strong>Datos que registra un negocio.</strong> El negocio cliente, como responsable, debe obtener la
          autorización de sus clientes, pagadores, proveedores y empleados y conservar la prueba (art. 9 de la Ley 1581
          de 2012 y art. 2.2.2.25.2.5 del Decreto 1074 de 2015). Servify POS no la solicita directamente a esas
          personas; si una de ellas pide la prueba a Servify POS, la solicitud se traslada al negocio.
        </li>
        <li>
          <strong>Cuándo no se requiere.</strong> No hace falta autorización en los casos del art. 10 de la Ley 1581 de
          2012, entre ellos la información requerida por una autoridad en ejercicio de sus funciones o por orden
          judicial, y los datos de naturaleza pública.
        </li>
      </ul>

      <h2 id="con-quien-se-comparten" class="text-h6">9. Con quién se comparten los datos</h2>
      <ul>
        <li>
          <strong>Dentro de cada negocio:</strong> los usuarios del mismo negocio ven la información según los permisos
          que les asigna su administrador. Un negocio nunca ve los datos de otro.
        </li>
        <li>
          <strong>Personal de Servify POS:</strong> accede a los datos de un negocio solo cuando hace falta para darle
          soporte, proteger el servicio o cumplir una obligación legal.
        </li>
        <li>
          <strong>Proveedores que tratan datos por cuenta de Servify POS</strong> (encargados, o subencargados frente a
          los datos de los negocios):
        </li>
      </ul>
      <!-- Four columns of prose do not fit a phone: there each provider is a block. -->
      <v-table density="compact" class="providers d-none d-md-block mb-4">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Qué hace</th>
            <th>Qué datos recibe</th>
            <th>Dónde</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="provider in PROVIDERS" :key="provider.name">
            <td>{{ provider.name }}</td>
            <td>{{ provider.does }}</td>
            <td>{{ provider.data }}</td>
            <td>{{ provider.where }}</td>
          </tr>
        </tbody>
      </v-table>
      <div class="d-md-none mb-4">
        <dl v-for="provider in PROVIDERS" :key="provider.name" class="provider border-b py-3">
          <dt class="font-weight-bold">{{ provider.name }}</dt>
          <dd><span class="text-medium-emphasis">Qué hace:</span> {{ provider.does }}</dd>
          <dd><span class="text-medium-emphasis">Qué datos recibe:</span> {{ provider.data }}</dd>
          <dd><span class="text-medium-emphasis">Dónde:</span> {{ provider.where }}</dd>
        </dl>
      </div>
      <ul>
        <li>
          <strong>Google Play:</strong> distribuye la app como responsable independiente (sección 4). Servify POS no le
          envía datos de los usuarios.
        </li>
        <li>
          <strong>Autoridades:</strong> cuando lo exija la ley o una orden judicial o administrativa (art. 13 de la Ley
          1581 de 2012).
        </li>
      </ul>
      <p>
        Servify POS no vende datos, no los cede para publicidad y no los comparte con terceros para fines propios de
        ellos.
      </p>

      <h2 id="transmision-internacional" class="text-h6">10. Transmisión internacional de datos</h2>
      <p>
        Los proveedores de la sección 9 están ubicados en Estados Unidos o tratan los datos en su red global. Como los
        tratan por cuenta de Servify POS y no deciden sobre ellos, el envío es una <strong>transmisión</strong>
        internacional (no una transferencia), amparada en los términos de tratamiento de datos que cada proveedor ofrece
        (art. 2.2.2.25.5.1 y 2.2.2.25.5.2 del Decreto 1074 de 2015). Estados Unidos figura en la lista de países con
        nivel adecuado de protección de la Superintendencia de Industria y Comercio (Circular Externa 005 de 2017).
      </p>
      <p>
        Para los datos que registran los negocios, al contratar el servicio el negocio autoriza a Servify POS a usar
        estos proveedores como subencargados.
      </p>

      <h2 id="seguridad" class="text-h6">11. Seguridad</h2>
      <ul>
        <li>Todo el tráfico entre el panel, la app, la API y la base de datos viaja cifrado (HTTPS/TLS).</li>
        <li>
          Las contraseñas se guardan con hash bcrypt y deben tener de 8 a 64 caracteres con al menos una letra y un
          número. Cambiar la contraseña cierra las demás sesiones. El enlace de recuperación vence en 60 minutos, sirve
          una sola vez y la respuesta es la misma exista o no el correo.
        </li>
        <li>
          La verificación en dos pasos es obligatoria para las cuentas de plataforma. Su secreto se guarda cifrado y los
          códigos de respaldo, de un solo uso, como huella.
        </li>
        <li>
          Los tokens de sesión se guardan como huella. La sesión web vence cada día; la móvil se cierra tras 30 días sin
          uso. Desactivar un usuario o un negocio cierra sus sesiones de inmediato.
        </li>
        <li>
          Tras 5 intentos fallidos, el inicio de sesión se bloquea por un minuto para ese usuario y esa dirección IP.
          Una cuenta inexistente y una contraseña errada reciben la misma respuesta.
        </li>
        <li>
          Cada registro lleva el identificador de su negocio y la aplicación filtra por él automáticamente; los archivos
          de cada negocio van en su propia carpeta.
        </li>
        <li>
          Los permisos se asignan por función, y las acciones delicadas (revertir un cobro, anular un pedido con
          productos, mover el corte de un turno de caja) son solo del administrador. El servidor valida cada permiso, no
          solo la pantalla.
        </li>
        <li>En la app, el token vive en el almacenamiento seguro de Android.</li>
        <li>La API solo acepta solicitudes de navegador desde el panel oficial.</li>
        <li>El entorno de producción no tiene datos de demostración ni contraseñas conocidas.</li>
        <li>
          Los archivos de Excel que se cargan se validan (tamaño, número de filas y estructura) y los que se descargan no
          contienen fórmulas.
        </li>
        <li>
          La base de datos permite recuperar su estado de cualquier momento de los últimos 7 días. Además hay una copia
          externa mensual en un equipo bajo control directo del responsable, con disco cifrado, y cada 3 meses se ensaya
          una restauración completa.
        </li>
        <li>El acceso administrativo a la infraestructura está limitado al responsable.</li>
      </ul>
      <p>
        Ninguna medida es infalible. Si ocurre un incidente que afecte datos personales, Servify POS lo contendrá,
        informará a la Superintendencia de Industria y Comercio como exige la ley (art. 17, literal n, y art. 18, literal
        k, de la Ley 1581 de 2012) y avisará a los negocios y, cuando corresponda, a los titulares afectados.
      </p>

      <h2 id="conservacion" class="text-h6">12. Conservación</h2>
      <ul>
        <li>
          <strong>Cuenta de usuario:</strong> mientras esté activa. Una cuenta desactivada se conserva hasta que el
          titular o el negocio pidan su eliminación (sección 13) o termine el contrato con el negocio.
        </li>
        <li>
          <strong>Sesiones y seguridad:</strong> la sesión web, hasta las 4:00 a. m. del día siguiente; la móvil, hasta
          que se cierre o tras 30 días sin uso; los enlaces de contraseña, 60 minutos; el registro de intentos fallidos,
          un minuto.
        </li>
        <li>
          <strong>Datos de los negocios (Servify POS como encargado):</strong> mientras el contrato esté vigente, incluso
          con la suscripción suspendida (en ese caso, en solo lectura). Al terminar, el negocio puede pedir una copia de
          su información y su eliminación; si no lo pide, se eliminan {{ POLICY.daysAfterTermination }} días después de
          la terminación. Conservar los libros y papeles del comerciante durante 10 años (art. 28 de la Ley 962 de 2005)
          es obligación de cada negocio, que debe descargar su información antes de que se elimine.
        </li>
        <li>
          <strong>Relación comercial de Servify POS</strong> (suscripción y pagos): durante el tiempo que exijan las
          normas contables, tributarias y comerciales, hasta 10 años (art. 28 de la Ley 962 de 2005).
        </li>
        <li>
          <strong>Respaldos:</strong> la recuperación a un punto en el tiempo cubre 7 días; las copias externas
          mensuales se guardan {{ POLICY.externalBackupsKept }}. Un dato eliminado desaparece de los respaldos cuando
          estos vencen. Los respaldos no se usan para recuperar datos eliminados a petición de su titular, salvo para
          restablecer el servicio después de un incidente, y en ese caso la eliminación se vuelve a aplicar.
        </li>
        <li>
          <strong>Registros técnicos:</strong> el tiempo que fija cada proveedor de infraestructura, en general días o
          semanas. Resend guarda los registros de los correos enviados 30 días.
        </li>
      </ul>
      <p>
        Las bases de datos estarán vigentes mientras Servify POS preste el servicio y, después, durante el tiempo
        necesario para cumplir las finalidades y obligaciones indicadas en esta sección.
      </p>

      <h2 id="eliminacion" class="text-h6">13. Eliminación de la cuenta y de los datos</h2>
      <p>
        La app de meseros no permite crear cuentas: el administrador del negocio crea las de sus empleados desde el
        panel web, y Servify POS crea la cuenta de cada negocio. Aun así, cualquier persona puede pedir la eliminación
        de su cuenta y de sus datos asociados sin reinstalar la app, así:
      </p>
      <ol>
        <li>Escribe a <a :href="mailto">{{ POLICY.email }}</a> con el asunto "Eliminar mi cuenta de Servify POS".</li>
        <li>
          Indica tu nombre, el código o nombre del negocio y el correo o nombre de usuario de la cuenta. Si escribes
          desde el correo registrado en la cuenta, no se requiere nada más. Si la cuenta no tiene correo (por ejemplo, la
          de un empleado), Servify POS verificará la identidad con el administrador del negocio o pidiendo la
          información mínima necesaria.
        </li>
        <li>
          Servify POS confirmará el recibo en máximo 2 días hábiles y completará la eliminación en máximo 15 días
          hábiles. Si no es posible en ese plazo, informará el motivo y la nueva fecha, que no superará 8 días hábiles
          más.
        </li>
      </ol>
      <p><strong>Cuenta de una persona</strong> (administrador, empleado o personal de plataforma):</p>
      <ul>
        <li>
          Se eliminan su nombre, correo, nombre de usuario, teléfono, contraseña, verificación en dos pasos y sesiones,
          y su acceso se cierra de inmediato.
        </li>
        <li>
          Los registros del negocio en los que aparece (pedidos, cobros, gastos y cierres de caja) se conservan porque
          forman parte de la contabilidad del negocio, pero quedan sin datos que identifiquen a la persona.
        </li>
        <li>Desactivar a un empleado desde Empleados le quita el acceso, pero no es una eliminación.</li>
      </ul>
      <p><strong>Un negocio completo</strong> (lo pide su administrador desde el correo registrado):</p>
      <ul>
        <li>
          Antes de eliminar, Servify POS ofrece una copia de la información: las exportaciones a Excel del panel y, si
          se pide, un archivo con todos los datos del negocio.
        </li>
        <li>
          Se eliminan todos los datos del negocio: usuarios, clientes y pagadores, proveedores, pedidos, cobros, cartera,
          recibos de caja, gastos, caja, inventario e imágenes.
        </li>
        <li>
          Se conservan solo los registros de la suscripción y de los pagos a Servify POS, por la obligación contable de
          la sección 12, y la constancia de la solicitud.
        </li>
        <li>La solicitud termina la suscripción. No hay cobros automáticos que cancelar.</li>
      </ul>
      <p>
        <strong>Datos de clientes, pagadores, proveedores o empleados que registró un negocio:</strong> el responsable
        de esos datos es el negocio, así que la solicitud debe dirigirse a él. Si llega a Servify POS, se trasladará al
        negocio en máximo 2 días hábiles, se le informará al solicitante y Servify POS aplicará la eliminación que el
        negocio ordene o que la ley exija.
      </p>
      <p>
        La eliminación no procede cuando el titular tiene un deber legal o contractual de permanecer en la base de datos
        (art. 2.2.2.25.2.6 del Decreto 1074 de 2015); por ejemplo, una factura ya emitida que el negocio debe conservar.
        En ese caso se informará qué datos se conservan, por qué y hasta cuándo. Los datos eliminados desaparecen de los
        respaldos según los plazos de la sección 12.
      </p>

      <h2 id="derechos" class="text-h6">14. Derechos de los titulares</h2>
      <p>Según el art. 8 de la Ley 1581 de 2012, el titular de los datos tiene derecho a:</p>
      <ol>
        <li>
          Conocer, actualizar y rectificar sus datos, incluidos los parciales, inexactos, incompletos o que induzcan a
          error.
        </li>
        <li>Solicitar prueba de la autorización otorgada, salvo cuando la ley no la exige (art. 10 de la Ley 1581 de 2012).</li>
        <li>Ser informado, previa solicitud, del uso que se ha dado a sus datos.</li>
        <li>
          Presentar quejas ante la Superintendencia de Industria y Comercio, después de haber agotado el trámite de
          consulta o reclamo ante Servify POS o ante el negocio responsable (art. 16 de la Ley 1581 de 2012).
        </li>
        <li>
          Revocar la autorización y solicitar la supresión de sus datos, salvo cuando exista un deber legal o
          contractual de permanecer en la base de datos.
        </li>
        <li>
          Acceder gratuitamente a sus datos, al menos una vez cada mes calendario y cada vez que esta política cambie de
          forma sustancial (art. 2.2.2.25.4.2 del Decreto 1074 de 2015).
        </li>
      </ol>
      <p>
        Pueden ejercer estos derechos el titular, acreditando su identidad; sus causahabientes; su representante o
        apoderado; y quien actúe por estipulación a favor de otro. Los derechos de los menores los ejercen sus
        representantes (art. 2.2.2.25.4.1 del Decreto 1074 de 2015).
      </p>
      <p>
        Los administradores y demás usuarios del panel pueden actualizar su nombre, correo y teléfono en Configuración y
        cambiar su contraseña en cualquier momento. Los empleados que solo usan la app piden los cambios a su
        administrador o a Servify POS.
      </p>

      <h2 id="consultas-y-reclamos" class="text-h6">15. Consultas y reclamos</h2>
      <p>
        <strong>Quién atiende.</strong> {{ POLICY.ownerName }}, como responsable, atiende directamente las consultas y
        reclamos sobre datos personales (art. 2.2.2.25.4.4 del Decreto 1074 de 2015), por correo a
        <a :href="mailto">{{ POLICY.email }}</a> o por escrito a {{ POLICY.address }}, {{ POLICY.city }}. El trámite es
        gratuito.
      </p>
      <p><strong>Consultas</strong> (conocer los datos, pedir prueba de la autorización o saber cómo se han usado):</p>
      <ul>
        <li>
          Se envían con el nombre del titular, un dato que permita ubicar la cuenta o el registro (correo, usuario,
          documento o negocio), lo que se pide y un medio para responder.
        </li>
        <li>
          Se responden en máximo 10 días hábiles desde su recibo. Si no es posible, se informa el motivo y la nueva
          fecha, que no superará 5 días hábiles más (art. 14 de la Ley 1581 de 2012).
        </li>
      </ul>
      <p>
        <strong>Reclamos</strong> (corregir, actualizar o suprimir datos, revocar la autorización o señalar un
        incumplimiento):
      </p>
      <ul>
        <li>
          Se envían con la identificación del titular, la descripción de los hechos, la dirección o el correo para
          responder y los documentos que se quieran hacer valer.
        </li>
        <li>
          Si el reclamo está incompleto, se pedirá completarlo dentro de los 5 días siguientes a su recibo. Si pasan 2
          meses sin respuesta, se entenderá que el titular desistió.
        </li>
        <li>Si el reclamo corresponde a un negocio cliente, se le trasladará en máximo 2 días hábiles y se informará al titular.</li>
        <li>
          En máximo 2 días hábiles desde que el reclamo esté completo, el registro se marcará como "reclamo en trámite",
          con su motivo, hasta que se resuelva.
        </li>
        <li>
          Se resuelve en máximo 15 días hábiles contados desde el día siguiente a su recibo. Si no es posible, se informa
          el motivo y la nueva fecha, que no superará 8 días hábiles más (art. 15 de la Ley 1581 de 2012).
        </li>
      </ul>
      <p>
        <strong>Ante la SIC.</strong> Agotado este trámite, el titular puede acudir a la Superintendencia de Industria y
        Comercio, Delegatura para la Protección de Datos Personales:
        <a href="https://www.sic.gov.co" target="_blank" rel="noopener">https://www.sic.gov.co</a>
      </p>

      <h2 id="compromisos-como-encargado" class="text-h6">16. Compromisos como encargado</h2>
      <p>Frente a los datos que registran los negocios, Servify POS:</p>
      <ul>
        <li>los trata solo para prestar el servicio y según las instrucciones del negocio;</li>
        <li>mantiene las medidas de seguridad de la sección 11;</li>
        <li>
          actualiza, rectifica o suprime la información que el negocio le reporte en máximo 5 días hábiles (art. 18 de la
          Ley 1581 de 2012);
        </li>
        <li>tramita las consultas y reclamos que le lleguen según la sección 15;</li>
        <li>informa al negocio y a la autoridad de los incidentes de seguridad que afecten sus datos;</li>
        <li>no usa esos datos para fines propios ni los entrega a terceros distintos de los subencargados de la sección 9.</li>
      </ul>

      <h2 id="cambios" class="text-h6">17. Cambios a esta política</h2>
      <p>
        Cualquier cambio se publicará en esta misma dirección, con una nueva versión y fecha. Los cambios sustanciales,
        como un cambio de responsable o de finalidades, se avisarán antes de aplicarse, por correo a los administradores
        de los negocios y con un aviso en el panel y en la app (art. 2.2.2.25.3.1 del Decreto 1074 de 2015). Si un
        cambio afecta las finalidades autorizadas, se pedirá una nueva autorización.
      </p>

      <h2 id="vigencia" class="text-h6">18. Vigencia</h2>
      <p>
        Esta política rige desde el {{ POLICY.effectiveDate }} (versión {{ POLICY.version }}) y se mantiene vigente
        mientras no se publique una nueva versión. Las bases de datos estarán vigentes según lo indicado en la sección 12.
      </p>

      <h2 id="normas" class="text-h6">19. Normas aplicables</h2>
      <ul>
        <li>Constitución Política de Colombia, art. 15.</li>
        <li>Ley Estatutaria 1581 de 2012, de protección de datos personales.</li>
        <li>Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015, Libro 2, Parte 2, Título 2, Capítulo 25.</li>
        <li>
          Circular Única de la Superintendencia de Industria y Comercio, Título V, adicionada por la Circular Externa 005
          de 2017 (transferencia internacional de datos).
        </li>
        <li>Ley 962 de 2005, art. 28 (conservación de libros y papeles del comerciante).</li>
        <li>Política de Datos del Usuario del Programa para Desarrolladores de Google Play.</li>
      </ul>
    </v-sheet>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { APP_ICON, APP_NAME } from '@/utils/branding'

/**
 * The responsible party's details and the retention periods: fill them here
 * and nowhere else. A value still in [BRACKETS] means the policy is not ready
 * to publish. `version` must match `auth.privacy_policy_version` in the
 * backend: raising both asks every user to accept the policy again.
 */
const POLICY = {
  version: '1.0',
  effectiveDate: '[FECHA DE ENTRADA EN VIGENCIA]',
  ownerName: '[NOMBRE COMPLETO]',
  ownerId: '[CÉDULA]',
  city: '[CIUDAD]',
  address: '[DIRECCIÓN]',
  phone: '[TELÉFONO]',
  email: 'soporte@servifypos.com',
  daysAfterTermination: '[PLAZO TRAS LA TERMINACIÓN]',
  externalBackupsKept: '[PLAZO DE COPIAS EXTERNAS]',
}

const SITE = 'https://app.servifypos.com'
const mailto = `mailto:${POLICY.email}`

/** Section 9: who processes data on Servify POS's behalf. */
const PROVIDERS = [
  {
    name: 'Laravel Cloud',
    does: 'Aloja la API, sus tareas programadas y sus registros técnicos, sobre infraestructura de Amazon Web Services',
    data: 'Todos los datos del servicio',
    where: 'Estados Unidos (región US East)',
  },
  {
    name: 'Neon (a través de Laravel Cloud)',
    does: 'Base de datos Postgres y sus respaldos de 7 días',
    data: 'Todos los datos del servicio',
    where: 'Estados Unidos (región US East)',
  },
  {
    name: 'Cloudflare',
    does: 'DNS de servifypos.com; entrega del panel web (Cloudflare Pages); red perimetral de Laravel Cloud (protección contra ataques y firewall); almacenamiento de imágenes (R2, a través de Laravel Cloud)',
    data: 'Dirección IP y datos técnicos de las conexiones; tráfico en tránsito; imágenes',
    where: 'Red global, con sede en Estados Unidos',
  },
  {
    name: 'Resend',
    does: 'Envío de correos transaccionales',
    data: 'Nombre, correo y contenido del mensaje (por ejemplo, el enlace para cambiar la contraseña)',
    where: 'Estados Unidos',
  },
  {
    name: 'Expo (EAS)',
    does: 'Compilación de la app y entrega de sus actualizaciones',
    data: 'Datos técnicos de la consulta de actualización (sección 4) y dirección IP',
    where: 'Estados Unidos',
  },
]

// Google Play and browser tabs read the document title.
let previousTitle = ''
onMounted(() => {
  previousTitle = document.title
  document.title = `Política de privacidad · ${APP_NAME}`
})
onUnmounted(() => {
  document.title = previousTitle
})
</script>

<style scoped>
.policy h2 {
  margin-top: 40px;
  margin-bottom: 12px;
  scroll-margin-top: 16px;
}

.policy h3 {
  margin-top: 24px;
  margin-bottom: 8px;
}

.policy p,
.policy ul,
.policy ol {
  margin-bottom: 16px;
}

.policy ul,
.policy ol {
  padding-inline-start: 24px;
}

.policy li {
  margin-bottom: 8px;
}

.policy li > ul {
  margin-top: 8px;
  margin-bottom: 8px;
}

.policy a {
  color: rgb(var(--v-theme-primary));
}

.providers td {
  vertical-align: top;
  padding-block: 8px;
}

.provider dd {
  margin-top: 4px;
}
</style>
