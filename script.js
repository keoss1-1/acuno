// script.js

// Objeto que almacena referencias a todos los elementos del DOM utilizados en el script
const DOMElements = {
    // Elementos relacionados con el inicio de sesión
    loginContainer: document.getElementById('loginContainer'),
    loginForm: document.getElementById('loginForm'),
    loginError: document.getElementById('loginError'),

    // Elementos principales de la aplicación después del login
    appContainer: document.getElementById('appContainer'),
    welcomeMessage: document.getElementById('welcomeMessage'),
    userButtons: document.getElementById('userButtons'), // Contenedor para botones de usuario (historial, gestión, etc.)
    logoutBtn: document.getElementById('logoutBtn'), // Botón de cerrar sesión

    // Elementos del formulario de cálculo principal
    mainApp: document.getElementById('mainApp'), // Sección principal de la app
    lossForm: document.getElementById('lossForm'), // Formulario de cálculo de pérdidas
    formErrors: document.getElementById('formErrors'), // Contenedor para errores del formulario
    resultDiv: document.getElementById('result'), // Contenedor para mostrar resultados del cálculo o historial
    calculateLossBtn: document.getElementById('calculateLossBtn'), // Botón de calcular
    resetButton: document.getElementById('resetButton'), // Botón de reiniciar formulario
    projectNameInput: document.getElementById('projectName'), // Campo: Nombre del proyecto
    distanceInput: document.getElementById('distance'), // Campo: Distancia de la fibra
    splitterType1Select: document.getElementById('splitterType1'), // Select: Tipo de splitter 1
    splitters1Input: document.getElementById('splitters1'), // Campo: Cantidad de splitter 1
    splitterType2Select: document.getElementById('splitterType2'), // Select: Tipo de splitter 2
    splitters2Input: document.getElementById('splitters2'), // Campo: Cantidad de splitter 2
    fusionSplicesInput: document.getElementById('fusionSplices'), // Campo: Empalmes de fusión

    // Elementos del panel de gestión de usuarios
    userManagementPanel: document.getElementById('userManagementPanel'),
    addUserForm: document.getElementById('addUserForm'),
    newUsernameInput: document.getElementById('newUsername'),
    newPasswordInput: document.getElementById('newPassword'),
    newLevelSelect: document.getElementById('newLevel'),
    usersList: document.getElementById('usersList'), // Lista donde se muestran los usuarios
    userFormError: document.getElementById('userFormError'), // Contenedor para errores del formulario de usuario

    // Elementos del modal de error global
    modalError: document.getElementById('modalError'),
    modalErrorMsg: document.getElementById('modalErrorMsg'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),

};

// Verificación de que el botón de logout existe (útil para depuración)
if (!DOMElements.logoutBtn) {
    console.error("Error crítico: El botón de cerrar sesión (logoutBtn) no fue encontrado en el DOM.");
} else {
    console.log("El botón de cerrar sesión (logoutBtn) fue encontrado con éxito:", DOMElements.logoutBtn);
}

let db; // Variable global para la base de datos IndexedDB
let currentUser = null; // Objeto para almacenar el usuario actualmente logueado

// Constantes para los cálculos de pérdida de señal
const CALCULATION_CONSTANTS = {
    INITIAL_SIGNAL: 6, // Señal inicial en dB (Decibelios)
    FIBER_LOSS_PER_KM: 0.2, // Pérdida por kilómetro de fibra en dB/km
    SPLICE_LOSS_PER_UNIT: 0.1 // Pérdida por empalme en dB/unidad
};

/**
 * Muestra un modal de error con un mensaje específico.
 * @param {string} message - El mensaje de error a mostrar.
 */
function showModalError(message) {
    DOMElements.modalErrorMsg.textContent = message; // Establece el mensaje
    DOMElements.modalError.classList.add('show'); // Muestra el modal
    DOMElements.modalError.focus(); // Enfoca el modal para accesibilidad
}

/**
 * Sanitiza una cadena de texto para evitar inyecciones HTML.
 * Convierte caracteres especiales HTML a sus entidades.
 * @param {string} str - La cadena a sanitizar.
 * @returns {string} La cadena sanitizada.
 */
function sanitizeHTML(str) {
    if (typeof str !== 'string') return ''; // Asegura que la entrada sea una cadena
    // Reemplaza caracteres HTML por sus entidades
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m]);
}

/**
 * Habilita o deshabilita los campos del formulario de cálculo.
 * @param {boolean} enabled - True para habilitar, False para deshabilitar.
 */
function setFormEnabledState(enabled) {
    // Itera sobre todos los elementos del formulario (excepto botones)
    Array.from(DOMElements.lossForm.elements).forEach(el => {
        if (el.tagName !== 'BUTTON') { // Evita deshabilitar los botones de envío
            el.disabled = !enabled;
        }
    });
    // Habilita/deshabilita los botones específicos
    if (DOMElements.calculateLossBtn) {
        DOMElements.calculateLossBtn.disabled = !enabled;
    }
    DOMElements.resetButton.disabled = !enabled;
}

/**
 * Valida los datos de entrada del formulario de cálculo.
 * Se añade la validación de 5 caracteres para los campos numéricos y el nombre del proyecto.
 * @param {object} data - Objeto con los valores del formulario.
 * @returns {string|null} Un mensaje de error si hay un problema, o null si la validación es exitosa.
 */
function validateInputData({ projectName, distance, splitterLoss1, splitters1, splitterLoss2, splitters2, fusionSplices }) {
    // Validación para el nombre del proyecto
    if (!projectName) return "El nombre del proyecto es obligatorio.";
    if (projectName.length > 50) return "El nombre del proyecto no puede exceder 50 caracteres.";


    // Validación para la distancia: número positivo, hasta 2 decimales, máximo 5 caracteres en total.
    // Ejemplo: 99.99 (5 caracteres), 123.4 (5 caracteres), 12345 (5 caracteres)
    const distanceStr = String(distance);
    if (isNaN(distance) || distance <= 0 || distanceStr.length > 5 || (distanceStr.includes('.') && distanceStr.split('.')[1]?.length > 2))
        return "La distancia debe ser un número positivo (máximo 5 caracteres en total, hasta 2 decimales).";

    // CAMBIO: Validación para la cantidad de splitters 1: número entero positivo, máximo 1 dígitos.
    const splitters1Str = String(splitters1);
    if (isNaN(splitterLoss1) || splitterLoss1 < 0) return "Selecciona un tipo válido para Splitter 1.";
    if (isNaN(splitters1) || splitters1 < 0 || !Number.isInteger(splitters1) || splitters1Str.length > 1)
        return "La cantidad de splitters 1 debe ser un número entero positivo (máximo 1 dígitos).";

    // CAMBIO: Validación para la cantidad de splitters 2: número entero positivo, máximo 1 dígitos.
    const splitters2Str = String(splitters2);
    if (isNaN(splitterLoss2) || splitterLoss2 < 0) return "Selecciona un tipo válido para Splitter 2.";
    if (isNaN(splitters2) || splitters2 < 0 || !Number.isInteger(splitters2) || splitters2Str.length > 1)
        return "La cantidad de splitters 2 debe ser un número entero positivo (máximo 1 dígitos).";

    // CAMBIO: Validación para la cantidad de empalmes de fusión: número entero positivo, máximo 2 dígitos.
    const fusionSplicesStr = String(fusionSplices);
    if (isNaN(fusionSplices) || fusionSplices < 0 || !Number.isInteger(fusionSplices) || fusionSplicesStr.length > 2)
        return "La cantidad de empalmes de fusión debe ser un número entero positivo (máximo 2 dígitos).";

    return null; // No hay errores
}

/**
 * Realiza el cálculo de la pérdida de señal en la fibra óptica.
 * @param {object} data - Objeto con los parámetros de cálculo.
 * @returns {number} La señal final calculada en dB.
 */
function calculateLoss({ distance, splitterLoss1, splitters1, splitterLoss2, splitters2, fusionSplices }) {
    // Cálculo de la pérdida total por distancia de fibra
    const totalFiberLoss = distance * CALCULATION_CONSTANTS.FIBER_LOSS_PER_KM;
    // Cálculo de la pérdida total por splitters
    const totalSplitterLoss = (splitterLoss1 * splitters1) + (splitterLoss2 * splitters2);
    // Cálculo de la pérdida total por empalmes de fusión
    const totalSpliceLoss = fusionSplices * CALCULATION_CONSTANTS.SPLICE_LOSS_PER_UNIT;

    // Cálculo de la señal final: señal inicial menos todas las pérdidas
    return CALCULATION_CONSTANTS.INITIAL_SIGNAL - (totalFiberLoss + totalSplitterLoss + totalSpliceLoss);
}

/**
 * Abre y/o inicializa la base de datos IndexedDB.
 * Crea los almacenes de objetos 'users' y 'calculations' si no existen,
 * e inserta usuarios por defecto la primera vez.
 * @returns {Promise<void>} Una promesa que se resuelve cuando la DB está abierta.
 */
async function openDB() {
    return new Promise((resolve, reject) => {
        // Abre la base de datos 'fiberAppDB' con versión 2
        const request = indexedDB.open('fiberAppDB', 2);

        // Se ejecuta cuando la base de datos necesita ser creada o actualizada (cambio de versión)
        request.onupgradeneeded = e => {
            db = e.target.result; // Obtiene la instancia de la DB

            // Crea el almacén de objetos 'users' si no existe
            if (!db.objectStoreNames.contains('users')) {
                const userStore = db.createObjectStore('users', { keyPath: 'username' }); // 'username' es la clave primaria
            }
            // Crea el almacén de objetos 'calculations' si no existe
            if (!db.objectStoreNames.contains('calculations')) {
                db.createObjectStore('calculations', { keyPath: 'id', autoIncrement: true }); // 'id' autoincremental
            }

            // Agrega usuarios por defecto solo si es la primera vez que se crea el almacén 'users'
            const userStore = request.transaction.objectStore('users');
            const defaultUsers = [
                { username: 'admin', password: 'admin123', level: 'administrador' },
                { username: 'user_advanced', password: 'advanced123', level: 'avanzado' },
                { username: 'user_basic', password: 'basic123', level: 'basico' }
            ];

            defaultUsers.forEach(user => {
                userStore.add(user).onerror = ev => {
                    // Manejo de error si el usuario ya existe (ConstraintError)
                    if (ev.target.error.name === 'ConstraintError') {
                        console.warn(`Usuario "${user.username}" ya existe, no se añadió de nuevo.`);
                    } else {
                        console.error(`Error añadiendo usuario "${user.username}":`, ev.target.error);
                    }
                };
            });
        };

        // Se ejecuta cuando la base de datos se abre con éxito
        request.onsuccess = e => {
            db = e.target.result;
            resolve();
        };

        // Se ejecuta si hay un error al abrir la base de datos
        request.onerror = e => {
            console.error("Error al abrir IndexedDB:", e.target.error);
            reject(e.target.error);
        };
    });
}

/**
 * Obtiene un usuario de la base de datos por su nombre de usuario.
 * @param {string} username - El nombre de usuario a buscar.
 * @returns {Promise<object|undefined>} Una promesa que resuelve con el objeto de usuario o undefined si no se encuentra.
 */
async function getUser(username) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('users', 'readonly'); // Transacción de solo lectura
        const store = transaction.objectStore('users'); // Accede al almacén 'users'
        const request = store.get(username); // Obtiene el usuario por clave primaria
        request.onsuccess = () => resolve(request.result);
        request.onerror = e => reject(new Error(`Error al obtener usuario: ${e.target.error.name}`));
    });
}

/**
 * Agrega un nuevo usuario a la base de datos.
 * @param {object} user - El objeto de usuario a agregar (username, password, level).
 * @returns {Promise<void>} Una promesa que se resuelve al añadir el usuario.
 */
async function addUser(user) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('users', 'readwrite'); // Transacción de lectura/escritura
        const store = transaction.objectStore('users');
        const request = store.add(user); // Agrega el usuario
        request.onsuccess = () => resolve();
        request.onerror = e => reject(new Error(`Error al añadir usuario: ${e.target.error.name}`));
    });
}

/**
 * Elimina un usuario de la base de datos por su nombre de usuario.
 * @param {string} username - El nombre de usuario a eliminar.
 * @returns {Promise<void>} Una promesa que se resuelve al eliminar el usuario.
 */
async function deleteUser(username) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('users', 'readwrite');
        const store = transaction.objectStore('users');
        const request = store.delete(username); // Elimina el usuario
        request.onsuccess = () => resolve();
        request.onerror = e => reject(new Error(`Error al eliminar usuario: ${e.target.error.name}`));
    });
}

/**
 * Obtiene todos los usuarios de la base de datos.
 * @returns {Promise<Array<object>>} Una promesa que resuelve con un array de todos los usuarios.
 */
async function getAllUsers() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        const request = store.getAll(); // Obtiene todos los objetos del almacén
        request.onsuccess = () => resolve(request.result);
        request.onerror = e => reject(new Error(`Error al obtener todos los usuarios: ${e.target.error.name}`));
    });
}

/**
 * Agrega un nuevo registro de cálculo a la base de datos.
 * @param {object} record - El objeto de cálculo a almacenar.
 * @returns {Promise<void>} Una promesa que se resuelve al añadir el registro.
 */
async function addCalculationRecord(record) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('calculations', 'readwrite');
        const store = transaction.objectStore('calculations');
        const request = store.add(record); // Agrega el registro de cálculo
        request.onsuccess = () => resolve();
        request.onerror = e => reject(new Error(`Error al añadir registro de cálculo: ${e.target.error.name}`));
    });
}

/**
 * Obtiene todos los registros de cálculos de la base de datos.
 * @returns {Promise<Array<object>>} Una promesa que resuelve con un array de todos los cálculos.
 */
async function getAllCalculations() {
    return new Promise((resolve, reject) => {
        console.log("DEPURACIÓN: Intentando obtener todos los cálculos de la DB...");
        const transaction = db.transaction('calculations', 'readonly');
        const store = transaction.objectStore('calculations');
        const request = store.getAll(); // Obtiene todos los registros de cálculo

        request.onsuccess = () => {
            console.log("DEPURACIÓN: Cálculos recuperados exitosamente:", request.result);
            resolve(request.result);
        };

        request.onerror = e => {
            console.error("DEPURACIÓN: ERROR en la solicitud de IndexedDB de getAllCalculations:", e.target.error);
            reject(new Error(`Error al obtener todos los cálculos: ${e.target.error.name}`));
        };
    });
}

/**
 * Elimina un registro de cálculo de la base de datos por su ID.
 * @param {number} id - El ID del registro de cálculo a eliminar.
 * @returns {Promise<void>} Una promesa que se resuelve al eliminar el registro.
 */
async function deleteCalculationRecord(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('calculations', 'readwrite');
        const store = transaction.objectStore('calculations');
        const request = store.delete(id); // Elimina el registro por ID
        request.onsuccess = () => resolve();
        request.onerror = e => reject(new Error(`Error al eliminar registro de cálculo: ${e.target.error.name}`));
    });
}

/**
 * Renderiza la lista de usuarios en el panel de gestión de usuarios.
 * Muestra el nombre de usuario y un botón para eliminar (excepto el usuario actual).
 */
async function renderUsersList() {
    try {
        const users = await getAllUsers(); // Obtiene todos los usuarios
        DOMElements.usersList.innerHTML = ''; // Limpia la lista actual
        const fragment = document.createDocumentFragment(); // Crea un fragmento para optimizar el DOM
        users.forEach(user => {
            if (currentUser && user.username === currentUser.username) return; // No mostrar al usuario logueado
            const li = document.createElement('li');
            li.textContent = `${user.username} (${user.level})`; // Muestra usuario y nivel
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Eliminar';
            delBtn.classList.add('btn');
            delBtn.classList.add('users-list__delete-btn');
            delBtn.setAttribute('aria-label', `Eliminar usuario ${user.username}`);
            delBtn.onclick = async () => { // Evento de clic para eliminar usuario
                if (confirm(`¿Eliminar usuario ${user.username}?`)) {
                    try {
                        await deleteUser(user.username); // Elimina de la DB
                        renderUsersList(); // Vuelve a renderizar la lista
                    } catch (error) {
                        console.error("Error al eliminar usuario en renderUsersList:", error);
                        showModalError('Hubo un problema al eliminar el usuario.');
                    }
                }
            };
            li.appendChild(delBtn);
            fragment.appendChild(li); // Añade el elemento a un fragmento
        });
        DOMElements.usersList.appendChild(fragment); // Añade el fragmento al DOM
    } catch (error) {
        console.error("Error cargando usuarios en renderUsersList:", error);
        showModalError('No se pudieron cargar los usuarios.');
    }
}

/**
 * Renderiza la interfaz de usuario basándose en el nivel del usuario logueado.
 * Muestra u oculta paneles y habilita/deshabilita opciones.
 * @param {string} level - El nivel del usuario ('administrador', 'avanzado', 'basico').
 */

function renderUserInterface(level) {
    DOMElements.welcomeMessage.textContent = `Bienvenido, ${currentUser.username} (Nivel: ${level})`;
    DOMElements.userButtons.innerHTML = ''; // Limpia los botones anteriores

    // Asegura que el panel principal esté visible y el de gestión oculto al inicio
    DOMElements.mainApp.classList.remove('hidden');
    DOMElements.userManagementPanel.classList.add('hidden');
    DOMElements.resultDiv.innerHTML = ''; // Limpia resultados o historial
    DOMElements.lossForm.reset(); // Resetea el formulario de cálculo
    DOMElements.formErrors.textContent = ''; // Limpia errores del formulario

    // Función auxiliar para crear botones
    const createButton = (text, onClickHandler, className = 'btn') => {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.onclick = onClickHandler;
        btn.classList.add(className);
        return btn;
    };

    // --- Modificación aquí: Cambiamos el orden de añadido de los botones ---

    // El botón de Gestión de Usuarios solo se muestra para administradores, y ahora será el primero si aplica.
    if (level === 'administrador') {
        DOMElements.userButtons.appendChild(createButton('Gestión de Usuarios', toggleUserManagement));
    }

    // Siempre se muestra el botón de Historial de Cálculos, y ahora será el segundo (o el primero si no es admin)
    DOMElements.userButtons.appendChild(createButton('Historial de Cálculos', showCalculationHistory));

    // El botón de Reportes Avanzados se muestra para administradores y avanzados, y ahora será el último.
    if (level === 'administrador' || level === 'avanzado') {
        DOMElements.userButtons.appendChild(createButton('Reportes Avanzados ', generatePrintableReport));
    }
}

/**
 * Muestra el historial de cálculos almacenados en la base de datos.
 * Renderiza los cálculos en una tabla.
 */
async function showCalculationHistory() {
    // Asegura que el panel principal esté visible y el de gestión oculto
    DOMElements.userManagementPanel.classList.add('hidden');
    DOMElements.mainApp.classList.remove('hidden');

    try {
        let calculations = await getAllCalculations(); // Obtiene todos los cálculos

        // Ordena los cálculos por fecha descendente
        calculations.sort((a, b) => new Date(b.calculatedAt) - new Date(a.calculatedAt));

        DOMElements.resultDiv.innerHTML = ''; // Limpia el área de resultados
        if (!calculations.length) {
            DOMElements.resultDiv.innerHTML = '<p>No hay cálculos almacenados en el historial.</p>';
            return;
        }

        // Crea la tabla HTML para mostrar los cálculos
        const table = document.createElement('table');
        table.setAttribute('aria-label', 'Historial de cálculos');
        table.setAttribute('role', 'table');
        table.classList.add('calculation-history-table');

        // Define las cabeceras de la tabla
        let tableHeaders = `
            <thead>
                <tr>
                    <th scope="col">Proyecto</th>
                    <th scope="col">Distancia (km)</th>
                    <th scope="col">Splitter 1 (dB)</th>
                    <th scope="col">Cant. S1</th>
                    <th scope="col">Splitter 2 (dB)</th>
                    <th scope="col">Cant. S2</th>
                    <th scope="col">Empalmes Fusión</th>
                    <th scope="col">Señal Final (dB)</th>
                    <th scope="col">Fecha y Hora</th>
                    <th scope="col">Realizado Por</th> `;

        // Si es administrador, añade la columna de acciones (eliminar)
        if (currentUser && currentUser.level === 'administrador') {
            tableHeaders += `<th scope="col">Acciones</th>`;
        }
        tableHeaders += `</tr></thead><tbody></tbody>`;
        table.innerHTML = tableHeaders;

        const tbody = table.querySelector('tbody');
        calculations.forEach(calc => {
            const row = document.createElement('tr');
            // Formatea la fecha para mostrarla
            const formattedDate = new Date(calc.calculatedAt).toLocaleString('es-VE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            // Rellena la fila con los datos del cálculo (sanitizando el nombre del proyecto y el usuario)
            row.innerHTML = `
                <td data-label="Proyecto">${sanitizeHTML(calc.projectName)}</td>
                <td data-label="Distancia (km)">${calc.distance}</td>
                <td data-label="Splitter 1 (dB)">${calc.splitterLoss1}</td>
                <td data-label="Cant. S1">${calc.splitters1}</td>
                <td data-label="Splitter 2 (dB)">${calc.splitterLoss2}</td>
                <td data-label="Cant. S2">${calc.splitters2}</td>
                <td data-label="Empalmes Fusión">${calc.fusionSplices}</td>
                <td data-label="Señal Final (dB)">${calc.finalSignal.toFixed(2)}</td>
                <td data-label="Fecha y Hora">${formattedDate}</td>
                <td data-label="Realizado Por">${sanitizeHTML(calc.calculatedBy || 'N/A')}</td> `;

            // Si es administrador, añade el botón de eliminar a la fila
            if (currentUser && currentUser.level === 'administrador') {
                const actionCell = document.createElement('td');
                actionCell.setAttribute('data-label', 'Acciones');
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Eliminar';
                deleteButton.classList.add('btn', 'delete-calc-btn');
                deleteButton.setAttribute('aria-label', `Eliminar cálculo del proyecto ${calc.projectName}`);
                deleteButton.onclick = async () => {
                    if (confirm(`¿Estás seguro de que quieres eliminar el cálculo del proyecto "${calc.projectName}"?`)) {
                        try {
                            await deleteCalculationRecord(calc.id); // Elimina el registro de la DB
                            showCalculationHistory(); // Actualiza el historial
                        } catch (error) {
                            console.error("Error al eliminar cálculo:", error);
                            showModalError('Hubo un problema al eliminar el cálculo.');
                        }
                    }
                };
                actionCell.appendChild(deleteButton);
                row.appendChild(actionCell);
            }
            tbody.appendChild(row);
        });
        DOMElements.resultDiv.appendChild(table); // Añade la tabla al DOM
    } catch (error) {
        console.error("Error cargando el historial de cálculos:", error);
        DOMElements.resultDiv.innerHTML = '<p>Error cargando el historial de cálculos.</p>';
    }
}

/**
 * Genera un informe HTML para impresión con todos los cálculos almacenados.
 * Incluye logos y una tabla organizada.
 */
async function generatePrintableReport() {
    console.log("--- Iniciando generatePrintableReport ---");
    try {
        await openDB(); // Asegura que la DB esté abierta
        console.log("Base de datos abierta.");

        let calculations = [];
        try {
            calculations = await getAllCalculations(); // Obtiene todos los cálculos
            console.log("Cálculos obtenidos para el reporte:", calculations);
            if (calculations.length === 0) {
                console.warn("getAllCalculations() retornó un array vacío.");
            }
        } catch (dbError) {
            console.error("ERROR: Fallo al obtener cálculos de IndexedDB:", dbError);
            showModalError('Fallo al cargar los cálculos desde la base de datos. Intenta nuevamente.');
            return;
        }

        if (!calculations || calculations.length === 0) {
            showModalError('No hay cálculos para incluir en el reporte.');
            console.log("No hay cálculos o la variable está indefinida/null, saliendo de la función.");
            return;
        }

        // Ordena los cálculos por fecha descendente para el reporte
        calculations.sort((a, b) => new Date(b.calculatedAt) - new Date(a.calculatedAt));

        let tableRowsHtml = '';
        calculations.forEach(calc => {
            const formattedDate = new Date(calc.calculatedAt).toLocaleString('es-VE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            tableRowsHtml += `
                <tr>
                    <td>${sanitizeHTML(calc.projectName)}</td>
                    <td>${calc.distance}</td>
                    <td>${calc.splitterLoss1}</td>
                    <td>${calc.splitters1}</td>
                    <td>${calc.splitterLoss2}</td>
                    <td>${calc.splitters2}</td>
                    <td>${calc.fusionSplices}</td>
                    <td>${calc.finalSignal.toFixed(2)}</td>
                    <td>${formattedDate}</td>
                    <td>${sanitizeHTML(calc.calculatedBy || 'N/A')}</td>
                </tr>
            `;
        });

        const reportContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reporte de Cálculos de Pérdidas</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20mm;
                        color: #333;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #eee;
                        padding-bottom: 10px;
                    }
                    .header img {
                        max-height: 80px;
                        width: auto;
                    }
                    .header h1 {
                        color: #003366;
                        text-align: center;
                        flex-grow: 1;
                        font-size: 24px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                        color: #003366;
                        font-weight: bold;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 40px;
                        font-size: 10px;
                        color: #777;
                    }
                    @media print {
                        body {
                            margin: 0;
                        }
                        .header {
                            margin-bottom: 20px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="images/logo-netuno.jpg" alt="Logo Netuno">
                    <h1>Reporte de Cálculos de Pérdidas</h1>
                    <img src="images/logo-unellez.png" alt="Logo Unellez"> </div>
                <table>
                    <thead>
                        <tr>
                            <th>Proyecto</th>
                            <th>Distancia (km)</th>
                            <th>Splitter 1 (dB)</th>
                            <th>Cant. S1</th>
                            <th>Splitter 2 (dB)</th>
                            <th>Cant. S2</th>
                            <th>Empalmes Fusión</th>
                            <th>Señal Final (dB)</th>
                            <th>Fecha y Hora</th>
                            <th>Realizado Por</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
                <div class="footer">
                    Reporte generado por el Sistema de Cálculo de Pérdidas en Fibra Óptica - ${new Date().toLocaleDateString('es-VE')}
                </div>
                <script>
                    window.onload = () => {
                        window.print();
                        // Opcional: Cerrar la ventana después de la impresión/cancelación.
                        // setTimeout(() => window.close(), 100);
                    };
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(reportContent);
            printWindow.document.close(); // Cierra el documento para asegurar que el contenido se carga
            // El window.print() se llama desde el script dentro de la ventana de impresión para asegurar que el DOM esté listo.
        } else {
            showModalError('No se pudo abrir una nueva ventana para el reporte. Asegúrate de que los bloqueadores de pop-ups estén desactivados.');
            console.error("Error: No se pudo abrir la ventana de impresión.");
        }

    } catch (error) {
        console.error("Error general en generatePrintableReport:", error);
        showModalError('Error generando el reporte. Revisa la consola para más detalles.');
    }
    console.log("--- Fin de generatePrintableReport ---");
}

/**
 * Alterna la visibilidad del panel de gestión de usuarios.
 * Cuando se muestra el panel de gestión, el panel principal de la app se oculta, y viceversa.
 */
function toggleUserManagement() {
    const isVisible = !DOMElements.userManagementPanel.classList.contains('hidden');
    if (isVisible) {
        // Si está visible, oculta el panel de gestión y muestra el principal
        DOMElements.userManagementPanel.classList.add('hidden');
        DOMElements.mainApp.classList.remove('hidden');
        DOMElements.resultDiv.innerHTML = ''; // Limpia el área de resultados/historial
    } else {
        // Si está oculto, muestra el panel de gestión y oculta el principal
        DOMElements.userManagementPanel.classList.remove('hidden');
        DOMElements.mainApp.classList.add('hidden');
        DOMElements.resultDiv.innerHTML = ''; // Limpia el área de resultados/historial
        renderUsersList(); // Carga y muestra la lista de usuarios
    }
}

// Event Listeners para el modal de error

// Cierra el modal de error al hacer clic en el botón 'Cerrar'
DOMElements.modalCloseBtn.addEventListener('click', () => {
    DOMElements.modalError.classList.remove('show');
});

// Cierra el modal de error al hacer clic fuera del modal (en el overlay)
DOMElements.modalError.addEventListener('click', (e) => {
    if (e.target === DOMElements.modalError) {
        DOMElements.modalError.classList.remove('show');
    }
});

// Event Listener para el formulario de inicio de sesión
DOMElements.loginForm.addEventListener('submit', async e => {
    e.preventDefault(); // Previene el envío por defecto del formulario
    DOMElements.loginError.textContent = ''; // Limpia mensajes de error anteriores

    try {
        await openDB(); // Asegura que la DB esté abierta

        const usernameInput = DOMElements.loginForm.username.value.trim();
        const passwordInput = DOMElements.loginForm.password.value.trim();

        // Validaciones básicas de campos
        if (!usernameInput || !passwordInput) {
            showModalError('Por favor, completa ambos campos de usuario y contraseña.');
            return;
        }

        const user = await getUser(usernameInput); // Intenta obtener el usuario de la DB
        if (!user) {
            showModalError('Usuario no encontrado.');
            return;
        }

        // Verifica la contraseña
        if (user.password !== passwordInput) {
            showModalError('Contraseña incorrecta.');
            return;
        }

        // Si el login es exitoso
        currentUser = user; // Establece el usuario actual
        DOMElements.loginContainer.classList.add('hidden'); // Oculta el contenedor de login
        DOMElements.appContainer.classList.remove('hidden'); // Muestra el contenedor de la aplicación
        renderUserInterface(user.level); // Renderiza la interfaz según el nivel del usuario
    } catch (error) {
        console.error("Error en el login:", error);
        showModalError('Error al intentar iniciar sesión. Inténtalo más tarde.');
    }
});

// Event Listener para el botón de cerrar sesión
DOMElements.logoutBtn.addEventListener('click', () => {
    console.log("¡Clic en el botón Cerrar Sesión detectado!");
    currentUser = null; // Limpia el usuario actual
    DOMElements.loginForm.reset(); // Resetea el formulario de login
    DOMElements.loginError.textContent = ''; // Limpia errores de login
    DOMElements.loginContainer.classList.remove('hidden'); // Muestra el contenedor de login
    DOMElements.appContainer.classList.add('hidden'); // Oculta el contenedor de la aplicación
    // Limpia y oculta paneles de la aplicación
    DOMElements.mainApp.classList.add('hidden');
    DOMElements.resultDiv.textContent = '';
    DOMElements.formErrors.textContent = '';
    DOMElements.userManagementPanel.classList.add('hidden');
});

// Event Listener para el formulario de añadir usuario
DOMElements.addUserForm.addEventListener('submit', async e => {
    e.preventDefault(); // Previene el envío por defecto
    DOMElements.userFormError.textContent = ''; // Limpia errores anteriores

    const username = DOMElements.newUsernameInput.value.trim();
    const password = DOMElements.newPasswordInput.value.trim();
    const level = DOMElements.newLevelSelect.value;

    // Validaciones
    if (!username || !password || !level) {
        DOMElements.userFormError.textContent = 'Completa todos los campos para añadir un usuario.';
        return;
    }

    if (currentUser && username === currentUser.username) {
        DOMElements.userFormError.textContent = 'No puedes modificar tu propio usuario desde aquí.';
        return;
    }

    try {
        const existingUser = await getUser(username); // Verifica si el usuario ya existe
        if (existingUser) {
            DOMElements.userFormError.textContent = 'El nombre de usuario ya existe.';
            return;
        }
        await addUser({ username, password, level }); // Añade el nuevo usuario
        // Limpia los campos del formulario
        DOMElements.newUsernameInput.value = '';
        DOMElements.newPasswordInput.value = '';
        DOMElements.newLevelSelect.value = '';
        renderUsersList(); // Actualiza la lista de usuarios
    } catch (error) {
        console.error("Error agregando usuario:", error);
        DOMElements.userFormError.textContent = 'Hubo un problema al agregar el usuario.';
    }
});

// Event Listener para el formulario de cálculo de pérdidas
DOMElements.lossForm.addEventListener('submit', async event => {
    event.preventDefault(); // Previene el envío por defecto

    DOMElements.formErrors.textContent = ''; // Limpia errores
    DOMElements.resultDiv.textContent = ''; // Limpia resultados

    setFormEnabledState(false); // Deshabilita el formulario durante el cálculo

    try {
        // Recopila los datos del formulario
        const data = {
            projectName: DOMElements.projectNameInput.value.trim(),
            distance: parseFloat(DOMElements.distanceInput.value),
            splitterLoss1: parseFloat(DOMElements.splitterType1Select.value),
            splitters1: parseInt(DOMElements.splitters1Input.value, 10), // Asegura que se parsea como entero
            splitterLoss2: parseFloat(DOMElements.splitterType2Select.value),
            splitters2: parseInt(DOMElements.splitters2Input.value, 10), // Asegura que se parsea como entero
            fusionSplices: parseInt(DOMElements.fusionSplicesInput.value, 10) // Asegura que se parsea como entero
        };

        const validationError = validateInputData(data); // Valida los datos
        if (validationError) {
            DOMElements.formErrors.textContent = validationError; // Muestra el error
            setFormEnabledState(true); // Vuelve a habilitar el formulario
            return;
        }

        const finalSignal = calculateLoss(data); // Realiza el cálculo

        // Muestra el resultado en el DOM
        DOMElements.resultDiv.innerHTML = `<h2>Resultado del Cálculo</h2>
        <p>Señal final: <strong>${finalSignal.toFixed(2)} dB</strong></p>`;

        // Prepara y guarda el registro del cálculo en la DB
        const record = {
            ...data, // Copia todos los datos del formulario
            finalSignal: finalSignal,
            calculatedAt: new Date().toISOString(), // Fecha y hora del cálculo
            calculatedBy: currentUser ? currentUser.username : 'Desconocido' // Usuario que realizó el cálculo
        };
        await addCalculationRecord(record); // Guarda el registro

    } catch (error) {
        console.error("Error al calcular pérdidas:", error);
        DOMElements.formErrors.textContent = 'Ocurrió un error inesperado. Intenta nuevamente.';
    }

    setFormEnabledState(true); // Habilita el formulario de nuevo
});

// Event Listener para el botón de reiniciar formulario
DOMElements.resetButton.addEventListener('click', () => {
    DOMElements.lossForm.reset(); // Resetea el formulario
    DOMElements.formErrors.textContent = ''; // Limpia errores
    DOMElements.resultDiv.textContent = ''; // Limpia resultados
    setFormEnabledState(true); // Asegura que el formulario esté habilitado
});

// Array de inputs numéricos que requieren validación especial (solo números, decimales y longitud)
const numericInputs = [
    DOMElements.distanceInput,
    DOMElements.splitters1Input,
    DOMElements.splitters2Input,
    DOMElements.fusionSplicesInput
];

// Añade un event listener 'input' a cada campo numérico para controlar la entrada de caracteres
numericInputs.forEach(input => {
    input.addEventListener('input', (e) => {
        let value = e.target.value;

        // Si el campo es de distancia, permite decimales y limita la longitud
        if (e.target.id === 'distance') {
            value = value.replace(/[^0-9.]/g, ''); // Permite dígitos y un punto decimal
            const parts = value.split('.');
            if (parts.length > 2) { // Asegura que solo haya un punto decimal
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            if (parts[1] && parts[1].length > 2) { // Limita a 2 decimales
                value = parts[0] + '.' + parts[1].substring(0, 2);
            }
            if (value.length > 5) { // Limita la longitud total a 5
                value = value.substring(0, 5);
            }
        } else {
            // CAMBIO: Para los campos de splitters y empalmes (que deben ser enteros)
            value = value.replace(/[^0-9]/g, ''); // Solo permite dígitos (sin punto decimal)
            if (value.length > 2) { // Limita la longitud total a 2 dígitos (modificado de 1 a 2)
                value = value.substring(0, 2);
            }
        }
        e.target.value = value; // Actualiza el valor del input
    });
});


// Inicializa la base de datos al cargar el script
openDB().catch(error => {
    console.error("Fallo al iniciar la base de datos:", error);
    showModalError("No se pudo inicializar la base de datos local. Algunas funciones podrían no estar disponibles.");
});
