// --- Configuration & Initialization ---
const CLOUD_CONFIG = {
    url: 'https://ilxdmxuvsefkqijeodlv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlseGRteHV2c2Vma3FpamVvZGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTQzNDAsImV4cCI6MjA5MTg3MDM0MH0.9R2bGdEKX-Jdtjcp0OW7Mq63XX7bVPWhR9pB_FC98dI'
};

let supabase = null;

// --- Data Models (State) ---
let employees = [];
let weeklyRoles = {}; // Keyed by Wednesday date string (YYYY-MM-DD)
let attendanceLogs = [];
let swapRequests = [];
let taskTemplates = [];
let dailyTasks = []; // Active instances of tasks for the current day

let currentPIN = "";
let currentUser = null; // Currently logged in user
let currentAdminTab = "monitoreo";
let currentTaskTab = "mis-tareas";
let expandedTaskIds = new Set();

// Weekday Names in Spanish
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// --- Default Base Data (Fallback) ---
const DEFAULT_EMPLOYEES = [
    { id: 1, name: "Juan Pérez", pin: "1111", is_admin: false },
    { id: 2, name: "María Gómez", pin: "2222", is_admin: false },
    { id: 3, name: "Pedro Alva", pin: "3333", is_admin: false },
    { id: 4, name: "Ana Ruiz", pin: "4444", is_admin: false },
    { id: 5, name: "Luis Delgado", pin: "5555", is_admin: false },
    { id: 99, name: "RH / Administrador", pin: "231217", is_admin: true }
];

// Default tasks if CSV is empty
const DEFAULT_TASKS_CSV = `Tarea,Rol,Turno,Dias,Imprescindible,Subtareas
Contar fondo de caja inicial (apertura),Cajera,Matutino,Todos,Si,
Limpieza de barra de atención y mesas de clientes,Cajera,Ambos,Todos,No,
Recibir y acomodar pan fresco del día,Cajera,Matutino,Todos,No,Croissants;Conchas;Mantecadas;Birotes;Donas
Limpieza y desinfección de la pantalla POS y terminales de pago,Cajera,Vespertino,Todos,No,
Corte de caja, arqueo de efectivo y resguardo de valores (cierre),Cajera,Vespertino,Todos,Si,
Calibración de molinos (peso y tiempo de extracción),Barista,Matutino,Todos,No,
Encendido y calentamiento de la máquina de espresso,Barista,Matutino,Todos,No,
Rellenar tolvas de café en grano e insumos de barra (leches y jarabes),Barista,Ambos,Todos,No,Café en grano;Leche entera;Leche deslactosada;Leche de almendra;Jarabe vainilla;Jarabe caramelo
Limpieza profunda de lancetas de vapor de la máquina de café,Barista,Vespertino,Todos,Si,
Lavado químico de filtros, portafiltros y duchas de espresso (backflush),Barista,Vespertino,Todos,Si,
Desarmado y limpieza interna del molino de café,Barista,Vespertino,Lunes,No,
Limpieza de barra de café, rejillas y sacudidores,Barista,Vespertino,Todos,No,
Sanitización de superficies de trabajo y utensilios en cocina,Cocina,Ambos,Todos,No,
Encendido de plancha, hornos y salamandra (apertura),Cocina,Matutino,Todos,No,
Preparación y porcionado de ingredientes (prep de verduras y proteínas),Cocina,Matutino,Todos,No,Picar jitomate;Picar cebolla;Picar lechuga;Rebanar jamón;Cocinar tocino
Control y registro de temperaturas de refrigeradores y congeladores,Cocina,Matutino,Todos,Si,
Limpieza profunda de plancha, estufa y campana de extracción,Cocina,Vespertino,Todos,No,
Lavado y sanitización de utensilios y loza de cocina (cierre),Cocina,Vespertino,Todos,No,
Retirar basura de cocina y desinfectar botes,Cocina,Vespertino,Todos,No,
Apagar plancha, hornos y salamandra (cierre),Cocina,Vespertino,Todos,Si,
Ir por compras locales del día (tiendita/verdulería),Cocina,Matutino,Todos,No,Comprar leche entera (6L);Comprar limones (1kg);Comprar aguacate (2kg);Comprar azúcar (2kg)
Lavado profundo de loza y cristalería acumulada,Apoyo,Ambos,Fin de Semana,No,
Apoyar en el servicio a mesas y entrega de pedidos a clientes,Apoyo,Ambos,Fin de Semana,No,
Limpieza y desinfección de sanitarios de clientes y personal,Apoyo,Ambos,Fin de Semana,No,Espejos;Inodoros;Lavabos;Toallas de papel;Jabón de manos
Rellenar servilleteros, cubiertos y estación de condimentos,Apoyo,Ambos,Fin de Semana,No,
Barrer y trapear el salón principal y terraza de la cafetería,Colaborativa,Ambos,Todos,No,
Limpieza de vidrios y puertas de acceso de la sucursal,Colaborativa,Matutino,Miércoles,No,
Sacar basura general de salón al contenedor externo (cierre),Colaborativa,Vespertino,Todos,Si,
Restablecer inventario de vasos, tapas, mangas y bolsas para llevar,Colaborativa,Vespertino,Todos,No,
Lavado profundo de trampas de grasa e hidráulica de cocina,Colaborativa,Vespertino,Lunes,Si,
Desinfección de menús físicos y estaciones de servicio,Colaborativa,Ambos,Todos,No,`;

// --- Current Roles Weekly View Helper ---
let currentRoleViewWeekStart = getStartOfWeekWednesday(new Date());

// --- Load / Save Local Database ---
function loadLocalDatabase() {
    console.log("Loading Local Storage database...");
    
    // Load Employees
    employees = JSON.parse(localStorage.getItem('roods_employees'));
    if (!employees || employees.length === 0) {
        employees = [...DEFAULT_EMPLOYEES];
        localStorage.setItem('roods_employees', JSON.stringify(employees));
    }
    
    // Load Weekly Roles
    weeklyRoles = JSON.parse(localStorage.getItem('roods_weekly_roles')) || {};
    
    // Load Attendance
    attendanceLogs = JSON.parse(localStorage.getItem('roods_attendance')) || [];
    
    // Load Swap Requests
    swapRequests = JSON.parse(localStorage.getItem('roods_swaps')) || [];
    
    // Load Daily Instantiated Tasks
    dailyTasks = JSON.parse(localStorage.getItem('roods_daily_tasks')) || [];
    
    // Load Task Templates
    const savedTemplates = localStorage.getItem('roods_task_templates');
    if (savedTemplates) {
        taskTemplates = JSON.parse(savedTemplates);
    } else {
        // Parse default CSV
        parseTasksCsv(DEFAULT_TASKS_CSV);
    }
}

function saveLocalDatabase() {
    localStorage.setItem('roods_employees', JSON.stringify(employees));
    localStorage.setItem('roods_weekly_roles', JSON.stringify(weeklyRoles));
    localStorage.setItem('roods_attendance', JSON.stringify(attendanceLogs));
    localStorage.setItem('roods_swaps', JSON.stringify(swapRequests));
    localStorage.setItem('roods_task_templates', JSON.stringify(taskTemplates));
    localStorage.setItem('roods_daily_tasks', JSON.stringify(dailyTasks));
}

// --- Supabase Cloud Sync Syncing ---
async function syncFromCloud() {
    if (!supabase) return;
    setSyncIndicator("Sincronizando...", "sync-active");
    
    try {
        // 1. Sync Employees
        const { data: dbEmp, error: errEmp } = await supabase.from('roods_employees').select('*');
        if (!errEmp && dbEmp && dbEmp.length > 0) {
            employees = dbEmp;
            localStorage.setItem('roods_employees', JSON.stringify(employees));
        }

        // 2. Sync Weekly Roles
        const { data: dbRoles, error: errRoles } = await supabase.from('roods_weekly_roles').select('*');
        if (!errRoles && dbRoles) {
            weeklyRoles = {};
            dbRoles.forEach(r => {
                const weekStr = r.week_start; // YYYY-MM-DD
                if (!weeklyRoles[weekStr]) weeklyRoles[weekStr] = {};
                weeklyRoles[weekStr][r.role_key] = r.employee_id;
            });
            localStorage.setItem('roods_weekly_roles', JSON.stringify(weeklyRoles));
        }

        // 3. Sync Attendance
        const { data: dbAtt, error: errAtt } = await supabase.from('roods_attendance').select('*');
        if (!errAtt && dbAtt) {
            attendanceLogs = dbAtt;
            localStorage.setItem('roods_attendance', JSON.stringify(attendanceLogs));
        }

        // 4. Sync Swaps
        const { data: dbSwaps, error: errSwaps } = await supabase.from('roods_swaps').select('*');
        if (!errSwaps && dbSwaps) {
            swapRequests = dbSwaps;
            localStorage.setItem('roods_swaps', JSON.stringify(swapRequests));
        }

        // 5. Sync Daily Tasks
        const { data: dbDaily, error: errDaily } = await supabase.from('roods_daily_tasks').select('*');
        if (!errDaily && dbDaily) {
            dailyTasks = dbDaily;
            localStorage.setItem('roods_daily_tasks', JSON.stringify(dailyTasks));
        }

        // 6. Sync Task Templates
        const { data: dbTemplates, error: errTemplates } = await supabase.from('roods_task_templates').select('*');
        if (!errTemplates && dbTemplates && dbTemplates.length > 0) {
            taskTemplates = dbTemplates;
            localStorage.setItem('roods_task_templates', JSON.stringify(taskTemplates));
        }

        setSyncIndicator("Nube Sincronizada", "");
        console.log("Supabase sync successful!");
    } catch (e) {
        console.error("Cloud Sync Failed, falling back to LocalStorage:", e);
        setSyncIndicator("Offline (Local)", "");
    }
}

async function pushToCloudTable(tableName, data) {
    if (!supabase) return;
    try {
        const { error } = await supabase.from(tableName).upsert(data);
        if (error) throw error;
        setSyncIndicator("Cambio Sincronizado", "");
    } catch (e) {
        console.warn(`Could not sync table ${tableName} to cloud:`, e);
        setSyncIndicator("Offline (Local)", "");
    }
}

function setSyncIndicator(text, className) {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;
    indicator.textContent = text;
    indicator.className = `sync-indicator ${className}`;
}

// --- Date & Time Utilities ---
function getStartOfWeekWednesday(d) {
    let date = new Date(d);
    let day = date.getDay(); // 0 is Sunday, ..., 6 is Saturday
    let diff = day - 3; // distance to Wednesday (3)
    if (diff < 0) {
        diff = 7 + diff; // Sunday (0) -> diff = -3 -> 4 days ago
    }
    let wednesday = new Date(date);
    wednesday.setDate(date.getDate() - diff);
    wednesday.setHours(0,0,0,0);
    return wednesday;
}

function formatDateString(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeString(isoString) {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        const hrs = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${hrs}:${mins}`;
    } catch(e) {
        return "";
    }
}

// --- Digital Live Clock ---
function startClock() {
    const clock = document.getElementById('digitalClock');
    setInterval(() => {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        if (clock) {
            clock.textContent = `${hrs}:${mins}:${secs}`;
        }
    }, 1000);
}

// --- Notification Banner Helper ---
let notificationTimeout = null;

function showNotification(msg, duration = 6000) {
    const notif = document.getElementById('notification');
    const notifText = document.getElementById('notificationText');
    if (!notif || !notifText) return;
    
    notifText.textContent = msg;
    notif.classList.add('show');
    
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    notificationTimeout = setTimeout(() => {
        notif.classList.remove('show');
        notificationTimeout = null;
    }, duration);
}

function hideNotification() {
    const notif = document.getElementById('notification');
    if (notif) {
        notif.classList.remove('show');
    }
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
}

// --- PIN Numeric Pad Logic ---
function pressPin(num) {
    if (currentPIN.length < 6) {
        currentPIN += num;
        updatePinDisplay();
    }
    
    // Check if the current pin matches any employee pin (dynamic length auto-login)
    const matched = employees.find(e => e.pin === currentPIN);
    if (matched) {
        setTimeout(login, 200);
    } else if (currentPIN.length === 6) {
        // If they entered 6 digits and no match was found, trigger login to show error
        setTimeout(login, 200);
    }
}

function clearPin() {
    currentPIN = "";
    updatePinDisplay();
}

function backspacePin() {
    currentPIN = currentPIN.slice(0, -1);
    updatePinDisplay();
}

function updatePinDisplay() {
    for (let i = 1; i <= 6; i++) {
        const dot = document.getElementById(`dot${i}`);
        if (dot) {
            if (i <= currentPIN.length) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        }
    }
}

// --- Authentication & Login ---
function login() {
    const matched = employees.find(e => e.pin === currentPIN);
    currentPIN = ""; // reset
    updatePinDisplay();

    if (!matched) {
        showNotification("❌ PIN incorrecto. Intenta de nuevo.");
        return;
    }

    currentUser = matched;
    
    // Navigate based on Role
    if (currentUser.is_admin) {
        showSection('adminSection');
        initAdminView();
    } else {
        showSection('employeeSection');
        initEmployeeView();
    }
    showNotification(`🔓 Bienvenido, ${currentUser.name}`);
}

function logout() {
    currentUser = null;
    currentPIN = "";
    updatePinDisplay();
    showSection('loginSection');
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(sectionId);
    if (section) section.classList.add('active');
}

// --- EMPLOYEE VIEW LOGIC ---
function initEmployeeView() {
    // Welcome message
    document.getElementById('employeeWelcome').textContent = `¡Hola, ${currentUser.name}!`;

    // Calculate current schedule
    const today = new Date();
    const dayName = WEEKDAYS[today.getDay()];
    const dateStr = `${dayName}, ${today.getDate()} de ${MONTHS[today.getMonth()]}`;
    document.getElementById('employeeDate').textContent = dateStr;

    // Check if it's Tuesday (Rest day)
    if (today.getDay() === 2) { // Tuesday
        document.getElementById('employeeRole').textContent = "Descanso";
        document.getElementById('employeeShift').textContent = "Día libre";
        document.getElementById('btnCheckIn').classList.add('hidden');
        document.getElementById('btnCheckOut').classList.add('hidden');
        document.getElementById('attendanceMessage').innerHTML = "☕ Hoy es Martes, <strong>Día de descanso</strong> de la cafetería.<br>¡Disfruta tu descanso!";
        document.getElementById('tasksContainer').classList.add('locked');
        return;
    }

    // Resolve today's shift assignment & swap
    const schedule = resolveTodaySchedule(currentUser.id, today);
    if (!schedule) {
        document.getElementById('employeeRole').textContent = "Sin Rol";
        document.getElementById('employeeShift').textContent = "No programado";
        document.getElementById('btnCheckIn').classList.add('hidden');
        document.getElementById('btnCheckOut').classList.add('hidden');
        document.getElementById('attendanceMessage').textContent = "No tienes un rol programado para hoy.";
        document.getElementById('tasksContainer').classList.add('locked');
        return;
    }

    document.getElementById('employeeRole').textContent = schedule.roleDisplay;
    document.getElementById('employeeShift').textContent = `Turno ${schedule.shift}`;

    // Attendance State Check
    updateAttendanceUI(today, schedule);
    checkForUrgentTasks();
}

function resolveTodaySchedule(empId, date) {
    const dateStr = formatDateString(date);
    const dayNum = date.getDay(); // 0 is Sun, 6 is Sat

    // 1. Check if there is an approved swap for today where this employee covers
    const approvedSwapCover = swapRequests.find(s => 
        s.request_date === dateStr && 
        s.to_employee_id === empId && 
        s.status === 'aprobado'
    );
    if (approvedSwapCover) {
        // Employee is covering someone else
        const originalOwner = employees.find(e => e.id === approvedSwapCover.from_employee_id);
        const rolesList = resolveRolesList(approvedSwapCover.role_name);
        return {
            roles: rolesList,
            roleDisplay: approvedSwapCover.role_name + ` (Cubre a ${originalOwner ? originalOwner.name : 'compañero'})`,
            shift: approvedSwapCover.shift,
            isSwap: true
        };
    }

    // Check if there is an approved swap where this employee was covered by someone else
    const approvedSwapRequester = swapRequests.find(s => 
        s.request_date === dateStr && 
        s.from_employee_id === empId && 
        s.status === 'aprobado'
    );
    if (approvedSwapRequester) {
        // Employee is covered by someone else, so they have no schedule today
        return null;
    }

    // 2. Fetch from Weekly schedule
    const wednesdayDate = getStartOfWeekWednesday(date);
    const wednesdayStr = formatDateString(wednesdayDate);
    const weekSchedule = weeklyRoles[wednesdayStr];

    if (!weekSchedule) return null;

    // Determine role keys that match this employee
    let employeeRoleKey = null;
    let employeeRoleName = "";
    let employeeShift = "";

    // Search through all keys
    for (const [key, val] of Object.entries(weekSchedule)) {
        if (val === empId) {
            employeeRoleKey = key;
            break;
        }
    }

    if (!employeeRoleKey) return null;

    // Map role key to role name and shift
    if (employeeRoleKey === 'matutino1') {
        employeeRoleName = "Cajera + Barista";
        employeeShift = "Matutino";
    } else if (employeeRoleKey === 'matutino2') {
        employeeRoleName = "Cocina";
        employeeShift = "Matutino";
    } else if (employeeRoleKey === 'vespertinoCajera') {
        employeeRoleName = "Cajera";
        employeeShift = "Vespertino";
    } else if (employeeRoleKey === 'vespertinoBarista') {
        employeeRoleName = "Barista";
        employeeShift = "Vespertino";
    } else if (employeeRoleKey === 'vespertinoCocina') {
        employeeRoleName = "Cocina";
        employeeShift = "Vespertino";
    } else if (employeeRoleKey === 'apoyo') {
        // Apoyo is only Sat/Sun
        if (dayNum === 0 || dayNum === 6) { // Sat or Sun
            employeeRoleName = "Rol de Apoyo";
            employeeShift = "Vespertino"; // Apoyo operates in the afternoon busy shift
        } else {
            return null; // Not active on weekdays
        }
    }

    const rolesList = resolveRolesList(employeeRoleName);
    return {
        roles: rolesList,
        roleDisplay: employeeRoleName,
        shift: employeeShift,
        isSwap: false
    };
}

function resolveRolesList(roleDisplay) {
    if (roleDisplay.includes("Cajera + Barista")) {
        return ["Cajera", "Barista"];
    } else if (roleDisplay.includes("Cajera")) {
        return ["Cajera"];
    } else if (roleDisplay.includes("Barista")) {
        return ["Barista"];
    } else if (roleDisplay.includes("Cocina")) {
        return ["Cocina"];
    } else if (roleDisplay.includes("Rol de Apoyo")) {
        return ["Apoyo"];
    }
    return [];
}

// Attendance Logs checks
function updateAttendanceUI(today, schedule) {
    const todayStr = formatDateString(today);
    
    // Find logs for today for this user
    const userTodayLogs = attendanceLogs.filter(l => 
        l.employee_id === currentUser.id && 
        l.date === todayStr
    );

    const checkIn = userTodayLogs.find(l => l.type === 'entrada');
    const checkOut = userTodayLogs.find(l => l.type === 'salida');

    const statusDot = document.getElementById('attendanceStatusDot');
    const btnIn = document.getElementById('btnCheckIn');
    const btnOut = document.getElementById('btnCheckOut');
    const msg = document.getElementById('attendanceMessage');
    const container = document.getElementById('tasksContainer');

    if (!checkIn) {
        // Has not checked in yet
        statusDot.className = "status-indicator-dot";
        btnIn.classList.remove('hidden');
        btnOut.classList.add('hidden');
        msg.textContent = "🔒 Por favor checa tu entrada para ver tus tareas de hoy.";
        container.classList.add('locked');
    } else if (checkIn && !checkOut) {
        // Checked in, active
        statusDot.className = "status-indicator-dot active";
        btnIn.classList.add('hidden');
        btnOut.classList.remove('hidden');
        msg.innerHTML = `📥 Entrada registrada: <strong>${checkIn.time}</strong>`;
        container.classList.remove('locked');
        
        // Generate and Load checklists
        generateDailyTasks(todayStr, schedule);
        renderChecklists(todayStr, schedule);
    } else {
        // Checked out
        statusDot.className = "status-indicator-dot";
        btnIn.classList.add('hidden');
        btnOut.classList.add('hidden');
        msg.innerHTML = `📤 Salida registrada: <strong>${checkOut.time}</strong> (Turno Terminado)`;
        container.classList.add('locked');
    }
}

function performCheckIn() {
    const today = new Date();
    const todayStr = formatDateString(today);
    const timeStr = today.toTimeString().split(' ')[0];

    const log = {
        id: Date.now(),
        employee_id: currentUser.id,
        employee_name: currentUser.name,
        date: todayStr,
        time: timeStr,
        type: 'entrada',
        timestamp: today.toISOString()
    };

    attendanceLogs.push(log);
    saveLocalDatabase();
    pushToCloudTable('roods_attendance', log);

    showNotification("📥 Entrada registrada con éxito.");
    initEmployeeView();
}

function performCheckOut() {
    // Check for pending mandatory tasks
    const today = new Date();
    const todayStr = formatDateString(today);
    const schedule = resolveTodaySchedule(currentUser.id, today);
    if (schedule) {
        // Find tasks for this employee on their active role/shift today
        const empTasks = dailyTasks.filter(d => 
            d.date === todayStr && 
            d.shift === schedule.shift && 
            schedule.roles.includes(d.role_name)
        );
        const pendingMandatory = empTasks.filter(t => t.Imprescindible === 'Si' && !t.completed);
        if (pendingMandatory.length > 0) {
            let taskNames = pendingMandatory.map(t => `• ${t.task_name}`).join("\n");
            alert(`⚠️ NO PUEDES REGISTRAR TU SALIDA.\n\nTienes tareas de seguridad o cierre imprescindibles pendientes:\n\n${taskNames}\n\nPor favor, complétalas para poder checar tu salida.`);
            return;
        }
    }

    if (!confirm("¿Estás seguro de que deseas checar tu salida? Se cerrará tu turno de hoy.")) {
        return;
    }

    const timeStr = today.toTimeString().split(' ')[0];

    const log = {
        id: Date.now(),
        employee_id: currentUser.id,
        employee_name: currentUser.name,
        date: todayStr,
        time: timeStr,
        type: 'salida',
        timestamp: today.toISOString()
    };

    attendanceLogs.push(log);
    saveLocalDatabase();
    pushToCloudTable('roods_attendance', log);

    showNotification("📤 Salida registrada. ¡Buen trabajo hoy!");
    initEmployeeView();
}

// --- Daily Task Generation and Rendering ---
function generateDailyTasks(dateStr, schedule) {
    const today = new Date(dateStr + "T00:00:00");
    const dayName = WEEKDAYS[today.getDay()];
    const isWeekend = (today.getDay() === 0 || today.getDay() === 6);

    // Fetch all active templates for today and current shift
    const matchingTemplates = taskTemplates.filter(t => {
        // Shift check
        const shiftMatch = (t.Turno === 'Ambos' || t.Turno === schedule.shift);
        
        // Day filter check
        let dayMatch = false;
        if (t.Dias === 'Todos') {
            dayMatch = true;
        } else if (t.Dias === 'Lunes-Viernes') {
            dayMatch = !isWeekend;
        } else if (t.Dias === 'Fin de Semana') {
            dayMatch = isWeekend;
        } else {
            // Specific day check (e.g. "Lunes", "Lunes, Miércoles")
            const parts = t.Dias.split(',').map(d => d.trim());
            dayMatch = parts.includes(dayName);
        }

        return shiftMatch && dayMatch;
    });

    // Check if daily tasks already exist for this date and shift
    const existing = dailyTasks.filter(d => d.date === dateStr && d.shift === schedule.shift);
    
    if (existing.length === 0) {
        // Instantiate tasks
        matchingTemplates.forEach(t => {
            let subtasksState = [];
            if (t.Subtareas && t.Subtareas.trim() !== "") {
                subtasksState = t.Subtareas.split(";").map(subName => ({
                    name: subName.trim(),
                    completed: false
                }));
            }

            const instance = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                date: dateStr,
                shift: schedule.shift,
                task_name: t.Tarea,
                role_name: t.Rol,
                completed: false,
                completed_by_employee_id: null,
                completed_by_name: null,
                completed_at: null,
                Imprescindible: t.Imprescindible || "No",
                Subtareas: t.Subtareas || "",
                subtasks_state: subtasksState
            };
            dailyTasks.push(instance);
        });
        saveLocalDatabase();
        
        // Push the new bulk of daily tasks to Supabase
        const newDaily = dailyTasks.filter(d => d.date === dateStr && d.shift === schedule.shift);
        pushToCloudTable('roods_daily_tasks', newDaily);
    }
}

function renderChecklists(dateStr, schedule) {
    const myTasksList = document.getElementById('myTasksList');
    const collabTasksList = document.getElementById('collabTasksList');

    if (!myTasksList || !collabTasksList) return;

    myTasksList.innerHTML = "";
    collabTasksList.innerHTML = "";

    // Filter today's tasks
    const todayShiftTasks = dailyTasks.filter(d => d.date === dateStr && d.shift === schedule.shift);

    // Individual tasks matching current user's roles
    const myTasks = todayShiftTasks.filter(t => schedule.roles.includes(t.role_name));
    
    // Collaborative tasks for the shift
    const collabTasks = todayShiftTasks.filter(t => t.role_name === 'Colaborativa');

    // Render My Tasks
    if (myTasks.length === 0) {
        myTasksList.innerHTML = `<div class="empty-state"><span class="empty-state-icon">🎉</span>No tienes tareas individuales hoy para el rol de ${schedule.roleDisplay}</div>`;
    } else {
        myTasks.forEach(task => {
            const item = createTaskItemElement(task, false);
            myTasksList.appendChild(item);
        });
    }

    // Render Collaborative Tasks
    if (collabTasks.length === 0) {
        collabTasksList.innerHTML = '<div class="empty-state"><span class="empty-state-icon">📋</span>No hay tareas colaborativas asignadas para este turno hoy</div>';
    } else {
        collabTasks.forEach(task => {
            const item = createTaskItemElement(task, true);
            collabTasksList.appendChild(item);
        });
    }

    // Update Progress Bar
    updateTaskProgress(myTasks);
}

function createTaskItemElement(task, isCollab) {
    const item = document.createElement('div');
    item.className = `task-item ${task.completed ? 'completed' : ''}`;
    item.style.flexDirection = "column";
    item.style.alignItems = "stretch";
    
    let metaText = `Rol: ${task.role_name}`;
    if (task.Imprescindible === 'Si') {
        metaText += ` | ⚠️ Imprescindible`;
    }
    if (task.completed && task.completed_at) {
        const timeStr = formatTimeString(task.completed_at);
        if (isCollab) {
            metaText = `Completada por: ${task.completed_by_name} (${timeStr})`;
        } else {
            metaText = `Completada (${timeStr})`;
        }
        if (task.Imprescindible === 'Si') {
            metaText += ` | ⚠️ Imprescindible`;
        }
    }

    const hasSubtasks = task.subtasks_state && task.subtasks_state.length > 0;
    const completedCount = hasSubtasks ? task.subtasks_state.filter(s => s.completed).length : 0;
    const subtaskSummary = hasSubtasks 
        ? ` (${completedCount}/${task.subtasks_state.length})`
        : "";

    const urgentBadge = task.is_urgent 
        ? `<span class="badge" style="background: linear-gradient(135deg, #f44336, #d32f2f); color: white; font-size: 0.7rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle; animation: bounce 1s infinite; display: inline-block;">URGENTE 🚨</span>`
        : "";

    item.innerHTML = `
        <div class="task-main-row" style="display: flex; align-items: center; width: 100%;">
            <div class="task-checkbox-container" id="chk-${task.id}">
                <span class="check-icon">✓</span>
            </div>
            <div class="task-text-container" style="flex-grow: 1; padding: 4px 0;">
                <span class="task-name" style="${task.is_urgent ? 'color: #d32f2f; font-weight: 700;' : ''}">${task.task_name}${subtaskSummary}${urgentBadge}</span>
                <span class="task-meta ${task.completed ? 'completed-by' : ''}">${metaText}</span>
            </div>
            ${hasSubtasks ? '<span class="chevron-icon" style="margin-left: 8px; font-weight: bold; cursor: pointer; transition: transform 0.2s; padding: 4px;">▼</span>' : ''}
        </div>
    `;

    const checkbox = item.querySelector('.task-checkbox-container');
    const textContainer = item.querySelector('.task-text-container');
    const chevron = item.querySelector('.chevron-icon');

    // Click on checkbox toggles the whole task
    checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleMainTask(task.id, isCollab);
    };

    if (hasSubtasks) {
        // Create subtasks container
        const subContainer = document.createElement('div');
        subContainer.className = "subtasks-container";
        
        // Restore expanded state
        const isCurrentlyExpanded = expandedTaskIds.has(task.id);
        subContainer.style.display = isCurrentlyExpanded ? "flex" : "none";
        if (chevron && isCurrentlyExpanded) {
            chevron.style.transform = "rotate(180deg)";
        }
        
        subContainer.style.marginTop = "10px";
        subContainer.style.paddingLeft = "36px";
        subContainer.style.flexDirection = "column";
        subContainer.style.gap = "8px";

        task.subtasks_state.forEach((sub, subIdx) => {
            const subItem = document.createElement('div');
            subItem.className = `subtask-item ${sub.completed ? 'completed' : ''}`;
            subItem.style.display = "flex";
            subItem.style.alignItems = "center";
            subItem.style.gap = "10px";
            subItem.style.fontSize = "0.85rem";
            subItem.style.color = "var(--text-secondary)";

            subItem.innerHTML = `
                <input type="checkbox" ${sub.completed ? 'checked' : ''} style="accent-color: var(--primary-gradient-start); width: 16px; height: 16px; cursor: pointer;">
                <span style="${sub.completed ? 'text-decoration: line-through; color: var(--text-light);' : ''}">${sub.name}</span>
            `;

            const subCheckbox = subItem.querySelector('input');
            subCheckbox.onchange = (e) => {
                e.stopPropagation();
                toggleSubtask(task.id, subIdx, subCheckbox.checked, isCollab);
            };

            subContainer.appendChild(subItem);
        });

        item.appendChild(subContainer);

        // Click text container or chevron to expand/collapse
        const toggleExpand = (e) => {
            e.stopPropagation();
            const isHidden = subContainer.style.display === "none";
            subContainer.style.display = isHidden ? "flex" : "none";
            if (chevron) {
                chevron.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
            }
            if (isHidden) {
                expandedTaskIds.add(task.id);
            } else {
                expandedTaskIds.delete(task.id);
            }
        };
        textContainer.onclick = toggleExpand;
        if (chevron) chevron.onclick = toggleExpand;
    } else {
        // No subtasks: clicking the text container also toggles completion
        textContainer.onclick = () => {
            toggleMainTask(task.id, isCollab);
        };
    }

    return item;
}

function toggleMainTask(taskId, isCollab) {
    const idx = dailyTasks.findIndex(d => d.id === taskId);
    if (idx === -1) return;

    const task = dailyTasks[idx];
    task.completed = !task.completed;

    if (task.completed) {
        task.completed_by_employee_id = currentUser.id;
        task.completed_by_name = currentUser.name;
        task.completed_at = new Date().toISOString();
        // If it has subtasks, mark all subtasks as completed
        if (task.subtasks_state) {
            task.subtasks_state.forEach(s => s.completed = true);
        }
        showNotification("✓ Tarea completada!");
    } else {
        task.completed_by_employee_id = null;
        task.completed_by_name = null;
        task.completed_at = null;
        // If it has subtasks, mark all subtasks as pending
        if (task.subtasks_state) {
            task.subtasks_state.forEach(s => s.completed = false);
        }
    }

    saveLocalDatabase();
    pushToCloudTable('roods_daily_tasks', task);

    // Refresh UI
    const today = new Date();
    const todayStr = formatDateString(today);
    const schedule = resolveTodaySchedule(currentUser.id, today);
    renderChecklists(todayStr, schedule);
}

function toggleSubtask(taskId, subIdx, isChecked, isCollab) {
    const idx = dailyTasks.findIndex(d => d.id === taskId);
    if (idx === -1) return;

    const task = dailyTasks[idx];
    if (!task.subtasks_state || !task.subtasks_state[subIdx]) return;

    task.subtasks_state[subIdx].completed = isChecked;

    // Check if all subtasks are completed
    const allCompleted = task.subtasks_state.every(s => s.completed);

    if (allCompleted) {
        task.completed = true;
        task.completed_by_employee_id = currentUser.id;
        task.completed_by_name = currentUser.name;
        task.completed_at = new Date().toISOString();
        showNotification("✓ Tarea completada!");
    } else {
        // If previously completed, mark as incomplete
        task.completed = false;
        task.completed_by_employee_id = null;
        task.completed_by_name = null;
        task.completed_at = null;
    }

    saveLocalDatabase();
    pushToCloudTable('roods_daily_tasks', task);

    // Refresh UI
    const today = new Date();
    const todayStr = formatDateString(today);
    const schedule = resolveTodaySchedule(currentUser.id, today);
    renderChecklists(todayStr, schedule);
}

function updateTaskProgress(myTasks) {
    const total = myTasks.length;
    if (total === 0) {
        document.getElementById('tasksPercentText').textContent = "100%";
        document.getElementById('tasksProgressBar').style.width = "100%";
        return;
    }
    const completed = myTasks.filter(t => t.completed).length;
    const percent = Math.round((completed / total) * 100);

    document.getElementById('tasksPercentText').textContent = `${percent}%`;
    document.getElementById('tasksProgressBar').style.width = `${percent}%`;
}

function switchTaskTab(tabId) {
    currentTaskTab = tabId;
    document.getElementById('tabMisTareas').className = `tab-btn ${tabId === 'mis-tareas' ? 'active' : ''}`;
    document.getElementById('tabColaborativas').className = `tab-btn ${tabId === 'colaborativas' ? 'active' : ''}`;

    document.getElementById('contentMisTareas').className = `tab-content ${tabId === 'mis-tareas' ? 'active' : ''}`;
    document.getElementById('contentColaborativas').className = `tab-content ${tabId === 'colaborativas' ? 'active' : ''}`;
}

// --- SHIFT SWAP MODAL LOGIC ---
function openSwapModal() {
    const select = document.getElementById('swapCover');
    if (!select) return;
    
    // Populate with other employees
    select.innerHTML = '<option value="" disabled selected>Selecciona un compañero...</option>';
    employees.forEach(e => {
        if (!e.is_admin && e.id !== currentUser.id) {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.name;
            select.appendChild(opt);
        }
    });

    // Set minimum date to today
    const dateInput = document.getElementById('swapDate');
    const today = new Date();
    dateInput.min = formatDateString(today);

    document.getElementById('swapModal').classList.remove('hidden');
}

function closeSwapModal() {
    document.getElementById('swapModal').classList.add('hidden');
    document.getElementById('swapForm').reset();
}

function submitSwapRequest(e) {
    e.preventDefault();
    const dateVal = document.getElementById('swapDate').value;
    const coverId = parseInt(document.getElementById('swapCover').value);

    // Validate date is not a Tuesday
    const targetDate = new Date(dateVal + "T00:00:00");
    if (targetDate.getDay() === 2) {
        alert("⚠️ No puedes solicitar cambios para un Martes, es el día de descanso de la cafetería.");
        return;
    }

    // Determine current employee's schedule for that future date
    const schedule = resolveTodaySchedule(currentUser.id, targetDate);
    if (!schedule) {
        alert("⚠️ No tienes un rol asignado para esa fecha, por lo que no es necesario cambiarlo.");
        return;
    }

    const request = {
        id: Date.now(),
        request_date: dateVal,
        from_employee_id: currentUser.id,
        from_employee_name: currentUser.name,
        to_employee_id: coverId,
        to_employee_name: employees.find(e => e.id === coverId).name,
        role_name: schedule.roleDisplay,
        shift: schedule.shift,
        status: 'pendiente',
        timestamp: new Date().toISOString()
    };

    swapRequests.push(request);
    saveLocalDatabase();
    pushToCloudTable('roods_swaps', request);

    closeSwapModal();
    showNotification("🚀 Solicitud enviada a RH correctamente.");
}

// --- HR ADMIN VIEW LOGIC ---
function initAdminView() {
    switchAdminTab('monitoreo');
    renderAdminMonitoreo();
}

function toPascalCase(str) {
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

function switchAdminTab(tabId) {
    currentAdminTab = tabId;
    document.querySelectorAll('.admin-nav .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Set active nav
    const activeBtn = document.getElementById(`tab${toPascalCase(tabId)}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Show active content
    document.querySelectorAll('.admin-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const activeContent = document.getElementById(`adminContent${toPascalCase(tabId)}`);
    if (activeContent) activeContent.classList.add('active');

    // Run tab-specific loading logic
    if (tabId === 'monitoreo') renderAdminMonitoreo();
    if (tabId === 'asistencia') renderAdminAttendance();
    if (tabId === 'roles') renderAdminWeeklyRoles();
    if (tabId === 'swaps') renderAdminSwaps();
    if (tabId === 'tareas-csv') renderAdminCsvView();
    if (tabId === 'empleados') renderAdminEmployees();

    updateSwapsBadge();
}

function updateSwapsBadge() {
    const pendingCount = swapRequests.filter(s => s.status === 'pendiente').length;
    const badge = document.getElementById('swapsBadge');
    if (badge) {
        if (pendingCount > 0) {
            badge.textContent = pendingCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// --- ADMIN TAB: MONITOREO ---
function renderAdminMonitoreo() {
    const grid = document.getElementById('monitoreoGrid');
    if (!grid) return;
    grid.innerHTML = "";

    const today = new Date();
    const todayStr = formatDateString(today);

    // Tuesday Rest Day Check
    if (today.getDay() === 2) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">☕ Hoy es Martes, día de descanso semanal. Sucursal Cerrada.</div>`;
        return;
    }

    // Determine active shifts today based on attendance or schedule
    // Let's check who is checked-in right now
    const todayEntries = attendanceLogs.filter(l => l.date === todayStr);
    const activeEmployeeIds = [];
    
    // We want to list all scheduled employees for today and show their progress
    // Generate roles lists for today
    const possibleRoleKeys = ['matutino1', 'matutino2', 'vespertinoCajera', 'vespertinoBarista', 'vespertinoCocina', 'apoyo'];
    
    const wedStr = formatDateString(getStartOfWeekWednesday(today));
    const weekSched = weeklyRoles[wedStr] || {};

    let hasScheduled = false;

    // Check individual tasks progress for each active employee schedule
    employees.forEach(emp => {
        if (emp.is_admin) return;

        // Resolve today's schedule for this employee
        const sched = resolveTodaySchedule(emp.id, today);
        if (sched) {
            hasScheduled = true;
            
            // Check check-in status
            const userLogs = todayEntries.filter(l => l.employee_id === emp.id);
            const checkIn = userLogs.find(l => l.type === 'entrada');
            const checkOut = userLogs.find(l => l.type === 'salida');

            let attendanceStatus = '<span class="text-orange">Pendiente de entrar</span>';
            if (checkIn && !checkOut) {
                attendanceStatus = `<span class="text-green">Activo (Entrada: ${checkIn.time})</span>`;
            } else if (checkOut) {
                attendanceStatus = `<span>Salió (${checkOut.time})</span>`;
            }

            // Calculate progress of daily tasks
            const empTasks = dailyTasks.filter(d => 
                d.date === todayStr && 
                d.shift === sched.shift && 
                sched.roles.includes(d.role_name)
            );
            
            const total = empTasks.length;
            const completed = empTasks.filter(t => t.completed).length;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 100;

            let tasksDetailsHtml = "";
            if (empTasks.length > 0) {
                tasksDetailsHtml = `<div class="monitor-tasks-list" style="margin-top: 12px; font-size: 0.8rem; border-top: 1px dashed rgba(0,0,0,0.08); padding-top: 8px;">`;
                empTasks.forEach(t => {
                    const statusIcon = t.completed ? "✅" : "⏳";
                    const timeText = t.completed && t.completed_at ? ` (${formatTimeString(t.completed_at)})` : "";
                    const color = t.completed ? "#388E3C" : "#888";
                    const textDecoration = t.completed ? "line-through" : "none";
                    tasksDetailsHtml += `<div style="color: ${color}; margin-bottom: 4px; display: flex; justify-content: space-between; text-decoration: ${textDecoration};">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;" title="${t.task_name}">${statusIcon} ${t.task_name}</span>
                        <span style="font-weight: 600; flex-shrink: 0; margin-left: 8px;">${timeText}</span>
                    </div>`;
                });
                tasksDetailsHtml += `</div>`;
            }

            const card = document.createElement('div');
            card.className = "monitor-card";
            card.innerHTML = `
                <h4>${emp.name}</h4>
                <p class="monitor-meta">${sched.roleDisplay} | Turno ${sched.shift}</p>
                <p class="monitor-meta">Estatus: ${attendanceStatus}</p>
                <div class="progress-summary" style="margin-top: 15px;">
                    <div class="progress-text-container">
                        <span>Tareas (${completed}/${total})</span>
                        <span>${percent}%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                    </div>
                </div>
                ${tasksDetailsHtml}
            `;
            grid.appendChild(card);
        }
    });

    // Render collaborative shift progress
    // Let's identify the active shifts today
    const shiftsToday = [];
    // If we have scheduled morning workers
    const morningSched = employees.some(e => !e.is_admin && resolveTodaySchedule(e.id, today)?.shift === 'Matutino');
    const eveningSched = employees.some(e => !e.is_admin && resolveTodaySchedule(e.id, today)?.shift === 'Vespertino');

    if (morningSched) shiftsToday.push('Matutino');
    if (eveningSched) shiftsToday.push('Vespertino');

    shiftsToday.forEach(shift => {
        const collabTasks = dailyTasks.filter(d => d.date === todayStr && d.shift === shift && d.role_name === 'Colaborativa');
        const total = collabTasks.length;
        const completed = collabTasks.filter(t => t.completed).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 100;

        let collabDetailsHtml = "";
        if (collabTasks.length > 0) {
            collabDetailsHtml = `<div class="monitor-tasks-list" style="margin-top: 12px; font-size: 0.8rem; border-top: 1px dashed rgba(0,0,0,0.08); padding-top: 8px;">`;
            collabTasks.forEach(t => {
                const statusIcon = t.completed ? "✅" : "⏳";
                const byText = t.completed && t.completed_by_name ? ` ${t.completed_by_name.split(' ')[0]}` : "";
                const timeText = t.completed && t.completed_at ? ` (${formatTimeString(t.completed_at)})` : "";
                const color = t.completed ? "#9c27b0" : "#888";
                const textDecoration = t.completed ? "line-through" : "none";
                collabDetailsHtml += `<div style="color: ${color}; margin-bottom: 4px; display: flex; justify-content: space-between; text-decoration: ${textDecoration};">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;" title="${t.task_name}">${statusIcon} ${t.task_name}</span>
                    <span style="font-weight: 600; flex-shrink: 0; margin-left: 8px; font-size: 0.75rem;">${byText}${timeText}</span>
                </div>`;
            });
            collabDetailsHtml += `</div>`;
        }

        const card = document.createElement('div');
        card.className = "monitor-card";
        card.style.borderColor = "#9c27b0";
        card.innerHTML = `
            <h4 style="color: #9c27b0;">Tareas Colaborativas</h4>
            <p class="monitor-meta">Turno ${shift}</p>
            <p class="monitor-meta">Estatus: Activas hoy</p>
            <div class="progress-summary" style="margin-top: 15px;">
                <div class="progress-text-container">
                    <span>Tareas (${completed}/${total})</span>
                    <span>${percent}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percent}%; background: linear-gradient(to right, #9c27b0, #e91e63);"></div>
                </div>
            </div>
            ${collabDetailsHtml}
        `;
        grid.appendChild(card);
    });

    if (!hasScheduled) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">📋 No hay roles semanales programados para la semana actual. Ve a la pestaña "Roles Semanales" para asignar personal.</div>`;
    }
}

// --- ADMIN TAB: ASISTENCIA ---
function renderAdminAttendance() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    const searchVal = document.getElementById('attendanceSearch').value.toLowerCase();

    // Sort logs chronologically, newest first
    const sorted = [...attendanceLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const filtered = sorted.filter(l => 
        l.employee_name.toLowerCase().includes(searchVal)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-light">No hay registros de asistencia coincidentes.</td></tr>`;
        return;
    }

    filtered.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="bold-label">${log.employee_name}</td>
            <td>${log.date}</td>
            <td style="font-feature-settings: 'tnum';">${log.time}</td>
            <td>
                <span class="status-indicator-dot ${log.type === 'entrada' ? 'active' : ''}"></span>
                ${log.type === 'entrada' ? 'Entrada 📥' : 'Salida 📤'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- ADMIN TAB: ROLES SEMANALES ---
function renderAdminWeeklyRoles() {
    // Label for current week
    const endOfWeek = new Date(currentRoleViewWeekStart);
    endOfWeek.setDate(currentRoleViewWeekStart.getDate() + 5); // Wednesday to Monday (+5 days)

    const label = `Semana del Miércoles ${currentRoleViewWeekStart.getDate()} de ${MONTHS[currentRoleViewWeekStart.getMonth()]} al Lunes ${endOfWeek.getDate()} de ${MONTHS[endOfWeek.getMonth()]}`;
    document.getElementById('roleWeekLabel').textContent = label;

    // Load schedule for this week
    const weekStr = formatDateString(currentRoleViewWeekStart);
    const schedule = weeklyRoles[weekStr] || {};

    const selectIds = ['roleMatutino1', 'roleMatutino2', 'roleVespertinoCajera', 'roleVespertinoBarista', 'roleVespertinoCocina', 'roleApoyo'];
    
    selectIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        // Reset and populate
        select.innerHTML = '<option value="0">-- Desocupado / Vacío --</option>';
        employees.forEach(emp => {
            if (emp.is_admin) return;
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.name;
            select.appendChild(opt);
        });

        // Set value
        const roleKey = getRoleKeyFromSelectId(id);
        const assignedEmpId = schedule[roleKey] || 0;
        select.value = assignedEmpId;
    });
}

function getRoleKeyFromSelectId(id) {
    if (id === 'roleMatutino1') return 'matutino1';
    if (id === 'roleMatutino2') return 'matutino2';
    if (id === 'roleVespertinoCajera') return 'vespertinoCajera';
    if (id === 'roleVespertinoBarista') return 'vespertinoBarista';
    if (id === 'roleVespertinoCocina') return 'vespertinoCocina';
    if (id === 'roleApoyo') return 'apoyo';
    return '';
}

function adjustRoleWeek(days) {
    currentRoleViewWeekStart.setDate(currentRoleViewWeekStart.getDate() + days);
    renderAdminWeeklyRoles();
}

function saveWeeklyRoles() {
    const weekStr = formatDateString(currentRoleViewWeekStart);
    if (!weeklyRoles[weekStr]) {
        weeklyRoles[weekStr] = {};
    }

    const selectIds = ['roleMatutino1', 'roleMatutino2', 'roleVespertinoCajera', 'roleVespertinoBarista', 'roleVespertinoCocina', 'roleApoyo'];
    
    selectIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        const roleKey = getRoleKeyFromSelectId(id);
        const empId = parseInt(select.value);

        if (empId === 0) {
            delete weeklyRoles[weekStr][roleKey];
        } else {
            weeklyRoles[weekStr][roleKey] = empId;
        }
    });

    saveLocalDatabase();

    // Push weekly roles to Supabase
    if (supabase) {
        const pushData = [];
        for (const [roleKey, empId] of Object.entries(weeklyRoles[weekStr])) {
            pushData.push({
                week_start: weekStr,
                role_key: roleKey,
                employee_id: empId
            });
        }
        // Sync week roles to cloud
        pushToCloudTable('roods_weekly_roles', pushData);
    }

    // Flash Save status
    const status = document.getElementById('rolesSaveStatus');
    if (status) {
        status.classList.add('show');
        setTimeout(() => {
            status.classList.remove('show');
        }, 1500);
    }
}

// --- ADMIN TAB: SOLICITUDES DE CAMBIOS (SWAPS) ---
function renderAdminSwaps() {
    const list = document.getElementById('adminSwapsList');
    if (!list) return;
    list.innerHTML = "";

    // Sort, newest first
    const sorted = [...swapRequests].sort((a, b) => b.id - a.id);

    if (sorted.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-state-icon">🔄</span>No se han registrado solicitudes de intercambio.</div>';
        return;
    }

    sorted.forEach(s => {
        const card = document.createElement('div');
        card.className = "swap-card";

        const formattedDate = new Date(s.request_date + "T00:00:00").toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });

        let actionHtml = "";
        if (s.status === 'pendiente') {
            actionHtml = `
                <div class="swap-card-actions">
                    <button class="btn-primary btn-small btn-approve" onclick="resolveSwap(${s.id}, 'aprobado')">Aprobar ✓</button>
                    <button class="btn-secondary btn-small btn-reject" onclick="resolveSwap(${s.id}, 'rechazado')">Rechazar ✗</button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="swap-card-info">
                <h4>${s.from_employee_name} solicita cobertura</h4>
                <p>Compañero que cubre: <strong>${s.to_employee_name}</strong></p>
                <p>Fecha: <strong>${formattedDate}</strong> | Rol: <strong>${s.role_name}</strong> | Turno: <strong>${s.shift}</strong></p>
                <p style="margin-top: 6px;">Estatus: <span class="swap-badge ${s.status}">${s.status.toUpperCase()}</span></p>
            </div>
            ${actionHtml}
        `;
        list.appendChild(card);
    });
}

function resolveSwap(swapId, status) {
    const idx = swapRequests.findIndex(s => s.id === swapId);
    if (idx === -1) return;

    swapRequests[idx].status = status;
    saveLocalDatabase();
    pushToCloudTable('roods_swaps', swapRequests[idx]);

    showNotification(`Solicitud de cambio ${status} exitosamente.`);
    renderAdminSwaps();
    updateSwapsBadge();
}

// --- ADMIN TAB: TAREAS CSV ---
// --- ADMIN TAB: TAREAS CRUD & CSV ---
function ensureTemplateIds() {
    taskTemplates.forEach((t, idx) => {
        if (!t.id) {
            t.id = Date.now() + idx;
        }
    });
}

function renderAdminCsvView() {
    const preview = document.getElementById('taskPreviewBody');
    if (!preview) return;

    ensureTemplateIds();
    preview.innerHTML = "";

    if (taskTemplates.length === 0) {
        preview.innerHTML = `<tr><td colspan="7" class="text-center text-light" style="padding: 20px;">No hay tareas cargadas. Usa el botón "Agregar Nueva Tarea" o importa un CSV.</td></tr>`;
        return;
    }

    taskTemplates.forEach(t => {
        const tr = document.createElement('tr');
        const impVal = t.Imprescindible || "No";
        const subsList = t.Subtareas ? t.Subtareas.split(';').map(s => s.trim()).filter(s => s) : [];
        const subsText = subsList.length > 0 ? `${subsList.length} subtarea(s)` : "Ninguna";
        
        tr.innerHTML = `
            <td class="bold-label">${t.Tarea}</td>
            <td><span class="badge" style="background-color: #673ab7; font-weight:700; margin:0;">${t.Rol}</span></td>
            <td>${t.Turno}</td>
            <td>${t.Dias}</td>
            <td><span style="font-weight:600; color: ${impVal === 'Si' ? '#e91e63' : '#666'}">${impVal}</span></td>
            <td><span style="font-size:0.85rem; color: #555;">${subsText}</span></td>
            <td>
                <div style="display:flex; gap: 6px;">
                    <button class="btn-small" onclick="openTaskTemplateModal(${t.id})" style="padding: 4px 8px; font-size:0.75rem;">Editar ✏️</button>
                    <button class="btn-delete-small" onclick="deleteTaskTemplate(${t.id})" style="padding: 4px 8px; font-size:0.75rem;">Borrar 🗑️</button>
                </div>
            </td>
        `;
        preview.appendChild(tr);
    });
}

function toggleCustomDaysInput() {
    const select = document.getElementById('templateDaysSelect');
    const customInput = document.getElementById('templateCustomDays');
    if (select && customInput) {
        if (select.value === 'Personalizado') {
            customInput.classList.remove('hidden');
        } else {
            customInput.classList.add('hidden');
            customInput.value = '';
        }
    }
}

function openTaskTemplateModal(id = null) {
    ensureTemplateIds();
    const modal = document.getElementById('taskTemplateModal');
    const form = document.getElementById('taskTemplateForm');
    const title = document.getElementById('taskTemplateModalTitle');
    
    if (!modal || !form || !title) return;
    
    form.reset();
    document.getElementById('templateCustomDays').classList.add('hidden');
    
    if (id) {
        // Edit mode
        const t = taskTemplates.find(item => item.id == id);
        if (!t) return;
        
        title.textContent = "Editar Tarea Base";
        document.getElementById('editTaskTemplateId').value = t.id;
        document.getElementById('templateTaskName').value = t.Tarea;
        document.getElementById('templateRole').value = t.Rol;
        document.getElementById('templateShift').value = t.Turno;
        
        // Days resolution
        const daysSelect = document.getElementById('templateDaysSelect');
        const customDays = document.getElementById('templateCustomDays');
        if (['Todos', 'Lunes-Viernes', 'Fin de Semana'].includes(t.Dias)) {
            daysSelect.value = t.Dias;
        } else {
            daysSelect.value = "Personalizado";
            customDays.classList.remove('hidden');
            customDays.value = t.Dias;
        }
        
        document.getElementById('templateMandatory').value = t.Imprescindible || "No";
        
        // Subtasks resolution (convert from semicolon to newlines for textarea)
        const subsText = t.Subtareas ? t.Subtareas.split(';').map(s => s.trim()).join('\n') : "";
        document.getElementById('templateSubtasks').value = subsText;
    } else {
        // Add mode
        title.textContent = "Agregar Nueva Tarea";
        document.getElementById('editTaskTemplateId').value = "";
    }
    
    modal.classList.remove('hidden');
}

function closeTaskTemplateModal() {
    const modal = document.getElementById('taskTemplateModal');
    if (modal) modal.classList.add('hidden');
}

async function deleteTaskTemplate(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar esta tarea base?")) return;
    
    const index = taskTemplates.findIndex(item => item.id == id);
    if (index === -1) return;
    
    const templateToDelete = taskTemplates[index];
    taskTemplates.splice(index, 1);
    saveLocalDatabase();
    
    // Cloud sync
    if (supabase) {
        try {
            // Delete from cloud by Tarea and Rol to match
            const { error } = await supabase
                .from('roods_task_templates')
                .delete()
                .eq('Tarea', templateToDelete.Tarea)
                .eq('Rol', templateToDelete.Rol);
                
            if (error) throw error;
            showNotification("🗑️ Tarea base eliminada de la nube.");
        } catch (e) {
            console.error("Failed to delete template from Supabase:", e);
            showNotification("⚠️ Eliminada localmente. Error de conexión con la nube.");
        }
    } else {
        showNotification("🗑️ Tarea base eliminada.");
    }
    
    renderAdminCsvView();
}

async function submitTaskTemplateForm(event) {
    event.preventDefault();
    ensureTemplateIds();
    
    const id = document.getElementById('editTaskTemplateId').value;
    const tarea = document.getElementById('templateTaskName').value.trim();
    const rol = document.getElementById('templateRole').value;
    const turno = document.getElementById('templateShift').value;
    
    const daysSelect = document.getElementById('templateDaysSelect').value;
    const customDays = document.getElementById('templateCustomDays').value.trim();
    const dias = daysSelect === 'Personalizado' ? customDays : daysSelect;
    
    const imprescindible = document.getElementById('templateMandatory').value;
    
    // Subtasks text conversion (newlines to semicolon-separated)
    const textareaVal = document.getElementById('templateSubtasks').value;
    const subtareas = textareaVal.split('\n').map(s => s.trim()).filter(s => s).join('; ');
    
    if (id) {
        // Edit mode
        const t = taskTemplates.find(item => item.id == id);
        if (t) {
            const oldTarea = t.Tarea;
            const oldRol = t.Rol;
            
            t.Tarea = tarea;
            t.Rol = rol;
            t.Turno = turno;
            t.Dias = dias;
            t.Imprescindible = imprescindible;
            t.Subtareas = subtareas;
            
            saveLocalDatabase();
            
            // Cloud sync
            if (supabase) {
                try {
                    // Update or upsert. First delete old if name/role changed, then insert new.
                    if (oldTarea !== tarea || oldRol !== rol) {
                        await supabase.from('roods_task_templates').delete().eq('Tarea', oldTarea).eq('Rol', oldRol);
                    }
                    
                    const dbObject = {
                        "Tarea": tarea,
                        "Rol": rol,
                        "Turno": turno,
                        "Dias": dias,
                        "Imprescindible": imprescindible,
                        "Subtareas": subtareas
                    };
                    
                    // If t.id is numeric and not Date.now() timestamp, include it
                    if (Number.isInteger(Number(t.id)) && Number(t.id) < 1e12) {
                        dbObject.id = Number(t.id);
                    }
                    
                    const { error } = await supabase.from('roods_task_templates').upsert(dbObject);
                    if (error) throw error;
                    showNotification("💾 Tarea base actualizada con éxito.");
                } catch (e) {
                    console.error("Failed to update template in Supabase:", e);
                    showNotification("⚠️ Guardada localmente. Error de sincronización.");
                }
            } else {
                showNotification("💾 Tarea base actualizada con éxito.");
            }
        }
    } else {
        // Add mode
        const newTemplate = {
            id: Date.now(),
            Tarea: tarea,
            Rol: rol,
            Turno: turno,
            Dias: dias,
            Imprescindible: imprescindible,
            Subtareas: subtareas
        };
        
        taskTemplates.push(newTemplate);
        saveLocalDatabase();
        
        // Cloud sync
        if (supabase) {
            try {
                const dbObject = {
                    "Tarea": tarea,
                    "Rol": rol,
                    "Turno": turno,
                    "Dias": dias,
                    "Imprescindible": imprescindible,
                    "Subtareas": subtareas
                };
                const { error } = await supabase.from('roods_task_templates').insert(dbObject);
                if (error) throw error;
                showNotification("💾 Tarea base agregada con éxito.");
            } catch (e) {
                console.error("Failed to insert template to Supabase:", e);
                showNotification("⚠️ Guardada localmente. Error de sincronización.");
            }
        } else {
            showNotification("💾 Tarea base agregada con éxito.");
        }
    }
    
    // Refresh templates from cloud to get real IDs if possible
    if (supabase) {
        try {
            const { data } = await supabase.from('roods_task_templates').select('*');
            if (data && data.length > 0) {
                taskTemplates = data;
                localStorage.setItem('roods_task_templates', JSON.stringify(taskTemplates));
            }
        } catch (err) {
            console.warn("Could not reload templates from Supabase", err);
        }
    }
    
    closeTaskTemplateModal();
    renderAdminCsvView();
}

function downloadTemplateCsv() {
    let csvContent = "Tarea,Rol,Turno,Dias,Imprescindible,Subtareas\n";
    
    if (taskTemplates.length > 0) {
        taskTemplates.forEach(t => {
            const escapedTask = t.Tarea.replace(/"/g, '""');
            const impVal = t.Imprescindible || "No";
            const subsVal = t.Subtareas || "";
            const escapedSubs = subsVal.replace(/"/g, '""');
            csvContent += `"${escapedTask}",${t.Rol},${t.Turno},${t.Dias},${impVal},"${escapedSubs}"\n`;
        });
    } else {
        csvContent += DEFAULT_TASKS_CSV.replace("Tarea,Rol,Turno,Dias,Imprescindible,Subtareas\n", "");
    }

    try {
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = csvContent;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand("copy");
        document.body.removeChild(tempTextArea);
        showNotification("📋 Estructura CSV copiada al portapapeles.");
    } catch(e) {
        console.warn("Clipboard copy failed:", e);
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "roods_tareas_plantilla.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importCsv(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const success = parseTasksCsv(text);
        if (success) {
            saveLocalDatabase();
            if (supabase) {
                // Clear templates in cloud first and insert new
                supabase.from('roods_task_templates').delete().neq('id', 0).then(() => {
                    const dbInsertData = taskTemplates.map(t => {
                        return {
                            "Tarea": t.Tarea,
                            "Rol": t.Rol,
                            "Turno": t.Turno,
                            "Dias": t.Dias,
                            "Imprescindible": t.Imprescindible || "No",
                            "Subtareas": t.Subtareas || ""
                        };
                    });
                    supabase.from('roods_task_templates').insert(dbInsertData).then(({ error }) => {
                        if (error) {
                            console.error("Error inserting CSV templates:", error);
                        } else {
                            supabase.from('roods_task_templates').select('*').then(({ data: freshData }) => {
                                if (freshData) {
                                    taskTemplates = freshData;
                                    localStorage.setItem('roods_task_templates', JSON.stringify(taskTemplates));
                                    renderAdminCsvView();
                                }
                            });
                        }
                    });
                });
            }
            renderAdminCsvView();
            showNotification("📤 Archivo CSV importado con éxito.");
        } else {
            alert("Error al procesar el archivo CSV. Asegúrate de tener los encabezados correctos: Tarea, Rol, Turno, Dias");
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

function parseTasksCsv(csvText) {
    try {
        const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== "");
        if (lines.length < 2) return false;

        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        const taskIdx = headers.indexOf("tarea");
        const roleIdx = headers.indexOf("rol");
        const shiftIdx = headers.indexOf("turno");
        const daysIdx = headers.indexOf("dias");
        const impIdx = headers.indexOf("imprescindible");
        const subsIdx = headers.indexOf("subtareas");

        if (taskIdx === -1 || roleIdx === -1 || shiftIdx === -1 || daysIdx === -1) {
            return false;
        }

        const templates = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const parts = parseCsvLineHelper(line);
            
            if (parts.length > 0 && parts[taskIdx]) {
                const impVal = (impIdx !== -1 && parts[impIdx]) ? parts[impIdx].trim() : "No";
                const subsVal = (subsIdx !== -1 && parts[subsIdx]) ? parts[subsIdx].trim() : "";
                templates.push({
                    Tarea: parts[taskIdx].trim(),
                    Rol: parts[roleIdx].trim(),
                    Turno: parts[shiftIdx].trim(),
                    Dias: parts[daysIdx].trim(),
                    Imprescindible: impVal,
                    Subtareas: subsVal
                });
            }
        }

        if (templates.length > 0) {
            taskTemplates = templates;
            return true;
        }
        return false;
    } catch (e) {
        console.error("CSV Parse Error:", e);
        return false;
    }
}

function parseCsvLineHelper(line) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            parts.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    parts.push(current);
    return parts;
}

// --- ADMIN TAB: EMPLEADOS ---
function renderAdminEmployees() {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    employees.forEach(emp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="bold-label">${emp.name}</td>
            <td style="font-feature-settings: 'tnum'; font-weight: 700; letter-spacing: 1.5px;">${emp.pin}</td>
            <td>${emp.is_admin ? '<span class="badge" style="background-color: #e91e63;">RH / Admin</span>' : '<span class="badge" style="background-color: #00bcd4;">Empleado</span>'}</td>
            <td>
                <button class="btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openEditEmployeeModal(${emp.id})">Editar ✏️</button>
                ${emp.id !== 99 ? `<button class="btn-delete-small" onclick="deleteEmployee(${emp.id})">Borrar 🗑️</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openAddEmployeeModal() {
    document.getElementById('employeeModalTitle').textContent = "Agregar Nuevo Empleado";
    document.getElementById('editEmployeeId').value = "";
    document.getElementById('employeeForm').reset();
    document.getElementById('employeeModal').classList.remove('hidden');
}

function openEditEmployeeModal(empId) {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    document.getElementById('employeeModalTitle').textContent = "Editar Empleado";
    document.getElementById('editEmployeeId').value = emp.id;
    document.getElementById('empName').value = emp.name;
    document.getElementById('empPin').value = emp.pin;
    document.getElementById('empAdmin').value = emp.is_admin.toString();

    document.getElementById('employeeModal').classList.remove('hidden');
}

function closeEmployeeModal() {
    document.getElementById('employeeModal').classList.add('hidden');
}

function submitEmployeeForm(e) {
    e.preventDefault();
    const idVal = document.getElementById('editEmployeeId').value;
    const nameVal = document.getElementById('empName').value.trim();
    const pinVal = document.getElementById('empPin').value.trim();
    const isAdminVal = document.getElementById('empAdmin').value === "true";

    // Validate unique PIN
    const duplicate = employees.find(emp => emp.pin === pinVal && emp.id.toString() !== idVal);
    if (duplicate) {
        alert(`⚠️ El PIN ${pinVal} ya está asignado a ${duplicate.name}. Por favor usa un PIN diferente.`);
        return;
    }

    if (idVal) {
        // Edit Mode
        const idx = employees.findIndex(e => e.id.toString() === idVal);
        if (idx > -1) {
            employees[idx].name = nameVal;
            employees[idx].pin = pinVal;
            employees[idx].is_admin = isAdminVal;
            pushToCloudTable('roods_employees', employees[idx]);
        }
    } else {
        // Add Mode
        const newEmp = {
            id: Date.now(),
            name: nameVal,
            pin: pinVal,
            is_admin: isAdminVal
        };
        employees.push(newEmp);
        pushToCloudTable('roods_employees', newEmp);
    }

    saveLocalDatabase();
    closeEmployeeModal();
    renderAdminEmployees();
    showNotification("Empleado guardado correctamente.");
}

function deleteEmployee(empId) {
    if (empId === 99) return; // Prevent deleting master admin

    if (!confirm("⚠️ ¿Estás seguro de que deseas eliminar a este empleado? Esto también afectará su programación de roles histórica.")) {
        return;
    }

    // Delete in cloud if Supabase exists
    if (supabase) {
        supabase.from('roods_employees').delete().eq('id', empId).then();
    }

    employees = employees.filter(e => e.id !== empId);
    saveLocalDatabase();
    renderAdminEmployees();
    showNotification("Empleado eliminado.");
}

// --- REAL-TIME URGENT TASKS LOGIC ---
let alarmInterval = null;
let currentUrgentAlertTask = null;

async function sendUrgentTask(event) {
    event.preventDefault();
    const taskText = document.getElementById('urgentTaskText').value.trim();
    const targetRole = document.getElementById('urgentTaskTarget').value;
    const targetShift = document.getElementById('urgentTaskShift').value;
    
    if (!taskText) return;
    
    const todayStr = formatDateString(new Date());
    const newUrgentTask = {
        id: Date.now(),
        date: todayStr,
        shift: targetShift,
        role_name: targetRole === 'Todos' ? 'Colaborativa' : targetRole,
        task_name: taskText,
        completed: false,
        is_collaborative: targetRole === 'Todos',
        subtasks_state: [],
        Imprescindible: 'No',
        is_urgent: true,
        urgent_acknowledged: false
    };
    
    // Add locally
    dailyTasks.push(newUrgentTask);
    saveLocalDatabase();
    
    // Reset form
    document.getElementById('urgentTaskText').value = "";
    showNotification("🚨 Tarea de urgencia enviada.");
    
    // Sync to Supabase
    if (supabase) {
        try {
            const dbObject = {
                task_date: newUrgentTask.date,
                shift: newUrgentTask.shift,
                assigned_role: newUrgentTask.role_name,
                task_name: newUrgentTask.task_name,
                completed: false,
                is_collaborative: newUrgentTask.is_collaborative,
                subtasks_state: [],
                Imprescindible: 'No',
                is_urgent: true,
                urgent_acknowledged: false
            };
            const { error } = await supabase.from('roods_daily_tasks').insert(dbObject);
            if (error) throw error;
        } catch (e) {
            console.error("Failed to insert urgent task to Supabase:", e);
            showNotification("⚠️ Creada localmente. Error de sincronización.");
        }
    }
    
    // Refresh admin view
    renderAdminMonitoreo();
}

function playSirenSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    let isHigh = false;
    
    const playTone = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(isHigh ? 950 : 750, ctx.currentTime);
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        
        isHigh = !isHigh;
    };
    
    playTone();
    alarmInterval = setInterval(playTone, 600);
}

function stopSirenSound() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
}

function triggerUrgentAlertIfApplicable(task) {
    if (!currentUser) return;
    const schedule = resolveTodaySchedule(currentUser.id, new Date());
    if (!schedule) return;
    
    const matchesShift = task.shift === 'Ambos' || task.shift === schedule.shift;
    const matchesRole = task.role_name === 'Colaborativa' || schedule.roles.includes(task.role_name);
    
    if (matchesShift && matchesRole && !task.urgent_acknowledged && !task.completed) {
        const modal = document.getElementById('urgentAlertModal');
        const text = document.getElementById('urgentAlertTaskText');
        if (modal && text) {
            text.textContent = task.task_name;
            modal.classList.remove('hidden');
            
            if (!alarmInterval) {
                playSirenSound();
            }
            
            currentUrgentAlertTask = task;
        }
    }
}

async function acknowledgeUrgentAlert() {
    stopSirenSound();
    
    const modal = document.getElementById('urgentAlertModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    if (currentUrgentAlertTask) {
        currentUrgentAlertTask.urgent_acknowledged = true;
        saveLocalDatabase();
        
        if (supabase) {
            try {
                const { error } = await supabase
                    .from('roods_daily_tasks')
                    .update({ urgent_acknowledged: true })
                    .eq('id', currentUrgentAlertTask.id);
                if (error) throw error;
            } catch (e) {
                console.error("Failed to update urgent task in cloud:", e);
            }
        }
        
        currentUrgentAlertTask = null;
    }
    
    const today = new Date();
    const todayStr = formatDateString(today);
    const schedule = resolveTodaySchedule(currentUser.id, today);
    if (schedule) {
        renderChecklists(todayStr, schedule);
    }
}

async function checkForUrgentTasks() {
    if (!currentUser || currentUser.is_admin) return;
    
    const today = new Date();
    const todayStr = formatDateString(today);
    const schedule = resolveTodaySchedule(currentUser.id, today);
    if (!schedule) return;
    
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('roods_daily_tasks')
                .select('*')
                .eq('task_date', todayStr)
                .eq('is_urgent', true);
                
            if (!error && data) {
                let hasNew = false;
                data.forEach(newTask => {
                    const mappedTask = {
                        id: newTask.id,
                        date: newTask.task_date,
                        shift: newTask.shift,
                        role_name: newTask.assigned_role,
                        task_name: newTask.task_name,
                        completed: newTask.completed,
                        is_collaborative: newTask.is_collaborative,
                        subtasks_state: newTask.subtasks_state || [],
                        Imprescindible: newTask.Imprescindible || 'No',
                        is_urgent: newTask.is_urgent,
                        urgent_acknowledged: newTask.urgent_acknowledged
                    };
                    
                    const existingIdx = dailyTasks.findIndex(d => d.id === mappedTask.id);
                    if (existingIdx === -1) {
                        dailyTasks.push(mappedTask);
                        hasNew = true;
                    } else {
                        // Keep acknowledgement and completion in sync
                        dailyTasks[existingIdx].urgent_acknowledged = mappedTask.urgent_acknowledged;
                        dailyTasks[existingIdx].completed = mappedTask.completed;
                    }
                });
                
                if (hasNew) {
                    saveLocalDatabase();
                }
            }
        } catch (e) {
            console.warn("Polling for urgent tasks failed:", e);
        }
    }
    
    // Alert on any unacknowledged urgent task matching current user's profile
    const todayTasks = dailyTasks.filter(d => 
        d.date === todayStr && 
        (d.shift === 'Ambos' || d.shift === schedule.shift) && 
        (d.role_name === 'Colaborativa' || schedule.roles.includes(d.role_name))
    );
    
    const urgentUnack = todayTasks.find(t => t.is_urgent && !t.urgent_acknowledged && !t.completed);
    if (urgentUnack) {
        triggerUrgentAlertIfApplicable(urgentUnack);
    }
}

function subscribeToUrgentTasks() {
    if (!supabase) return;
    
    supabase
        .channel('urgent-tasks')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'roods_daily_tasks' },
            (payload) => {
                const newTask = payload.new;
                if (!newTask || !newTask.is_urgent) return;
                
                const mappedTask = {
                    id: newTask.id,
                    date: newTask.task_date,
                    shift: newTask.shift,
                    role_name: newTask.assigned_role,
                    task_name: newTask.task_name,
                    completed: newTask.completed,
                    is_collaborative: newTask.is_collaborative,
                    subtasks_state: newTask.subtasks_state || [],
                    Imprescindible: newTask.Imprescindible || 'No',
                    is_urgent: newTask.is_urgent,
                    urgent_acknowledged: newTask.urgent_acknowledged
                };
                
                if (!dailyTasks.some(d => d.id === mappedTask.id)) {
                    dailyTasks.push(mappedTask);
                    saveLocalDatabase();
                    
                    // Show alert immediately if matching user profile
                    triggerUrgentAlertIfApplicable(mappedTask);
                }
            }
        )
        .subscribe();
}

// --- Dynamic SDK Loading ---
function loadSupabaseDynamically() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
        try {
            if (window.supabase) {
                supabase = window.supabase.createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.key);
                console.log("Supabase client loaded dynamically.");
                syncFromCloud();
                subscribeToUrgentTasks();
            }
        } catch (e) {
            console.error("Supabase failed to initialize:", e);
        }
    };
    script.onerror = () => {
        console.warn("Offline mode: Could not load Supabase SDK. Local database only.");
    };
    document.head.appendChild(script);
}

// --- APP STARTUP ---
function initApp() {
    loadLocalDatabase();
    startClock();
    loadSupabaseDynamically();
    
    // Check and poll for urgent tasks every 5 seconds
    setInterval(checkForUrgentTasks, 5000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
