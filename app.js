// --- Configuration & Initialization ---
const CLOUD_CONFIG = {
    url: 'https://ilxdmxuvsefkqijeodlv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlseGRteHV2c2Vma3FpamVvZGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTQzNDAsImV4cCI6MjA5MTg3MDM0MH0.9R2bGdEKX-Jdtjcp0OW7Mq63XX7bVPWhR9pB_FC98dI'
};

let supabase = null;

// --- ROODS 8 Roles Configuration with Schedules ---
const ROODS_ROLES = {
    'matutinoCajeroBarista': {
        key: 'matutinoCajeroBarista',
        name: 'Cajero - Barista',
        shift: 'Matutino',
        hours: '9:30 - 17:30',
        taskRoles: ['Cajera', 'Barista']
    },
    'matutinoCocinaBarista': {
        key: 'matutinoCocinaBarista',
        name: 'Cocina - Barista',
        shift: 'Matutino',
        hours: '9:30 - 17:30',
        taskRoles: ['Cocina', 'Barista']
    },
    'vespertinoCajero': {
        key: 'vespertinoCajero',
        name: 'Cajero',
        shift: 'Vespertino',
        hours: '17:00 - 22:30',
        taskRoles: ['Cajera']
    },
    'vespertinoBarista': {
        key: 'vespertinoBarista',
        name: 'Barista',
        shift: 'Vespertino',
        hours: '17:00 - 22:30',
        taskRoles: ['Barista']
    },
    'vespertinoCocina': {
        key: 'vespertinoCocina',
        name: 'Cocina',
        shift: 'Vespertino',
        hours: '17:00 - 22:30',
        taskRoles: ['Cocina']
    },
    'auxAdministrativo': {
        key: 'auxAdministrativo',
        name: 'Aux. Administrativo',
        shift: 'Matutino',
        hours: '14:30 - 17:00',
        taskRoles: ['Apoyo']
    },
    'apoyoCocina': {
        key: 'apoyoCocina',
        name: 'Apoyo Cocina',
        shift: 'Matutino',
        hours: '14:30 - 17:00',
        taskRoles: ['Cocina', 'Apoyo']
    },
    'apoyoGeneral': {
        key: 'apoyoGeneral',
        name: 'Apoyo General',
        shift: 'Mixto',
        hours: '12:00 - 22:30',
        taskRoles: ['Apoyo']
    }
};

// --- Data Models (State) ---
let employees = [];
let weeklyRoles = {}; // Keyed by Wednesday date string (YYYY-MM-DD)
let attendanceLogs = [];
let swapRequests = [];
let taskTemplates = [];
let dailyTasks = []; // Active instances of tasks for the current day
let muroMessages = []; // Muro de Avisos messages
let lastReadMuroTimestamp = localStorage.getItem('roods_last_read_muro') || '1970-01-01T00:00:00.000Z';

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
        const payload = Array.isArray(data) ? data : [data];
        const { error } = await supabase.from(tableName).upsert(payload);
        if (error) throw error;
        setSyncIndicator("Cambio Sincronizado", "");
    } catch (e) {
        console.warn(`Could not sync table ${tableName} to cloud:`, e);
        setSyncIndicator("Offline (Local)", "");
        showNotification(`⚠️ Error al sincronizar ${tableName}: ${e.message || JSON.stringify(e)}`, 8000);
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
    const displayName = currentUser.nickname || currentUser.name;
    document.getElementById('employeeWelcome').textContent = `¡Hola, ${displayName}!`;

    // Render avatar
    const avatarImg = document.getElementById('employeeProfilePic');
    if (avatarImg) {
        avatarImg.src = currentUser.photo || '';
    }

    // Calculate current schedule
    const today = new Date();
    const dayName = WEEKDAYS[today.getDay()];
    const dateStr = `${dayName}, ${today.getDate()} de ${MONTHS[today.getMonth()]}`;
    document.getElementById('employeeDate').textContent = dateStr;

    // Check if it's Tuesday (Rest day)
    if (today.getDay() === 2) { // Tuesday
        document.getElementById('employeeRolesContainer').innerHTML = '<span style="background:#FFEBEB; color:#C62828; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">Descanso - Sucursal Cerrada</span>';
        const shiftsContainer = document.getElementById('checadorShiftsContainer');
        shiftsContainer.innerHTML = `<p class="attendance-message">☕ Hoy es Martes, <strong>Día de descanso</strong> de la cafetería.<br>¡Disfruta tu descanso!</p>`;
        document.getElementById('tasksContainer').classList.add('locked');
        return;
    }

    // Resolve today's shift assignments (can be multiple)
    const schedules = resolveTodaySchedules(currentUser.id, today);
    const rolesContainer = document.getElementById('employeeRolesContainer');
    rolesContainer.innerHTML = '';

    if (schedules.length === 0) {
        rolesContainer.innerHTML = '<span style="background:#ECEFF1; color:#37474F; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">Sin Rol Asignado Hoy</span>';
        const shiftsContainer = document.getElementById('checadorShiftsContainer');
        shiftsContainer.innerHTML = `<p class="attendance-message">No tienes un rol programado para hoy.</p>`;
        document.getElementById('tasksContainer').classList.add('locked');
        return;
    }

    // Render badges for each schedule
    schedules.forEach(sched => {
        const badge = document.createElement('span');
        badge.style.fontSize = '0.75rem';
        badge.style.fontWeight = '700';
        badge.style.padding = '4px 10px';
        badge.style.borderRadius = '12px';
        badge.style.display = 'inline-block';
        badge.style.background = 'linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end))';
        badge.style.color = 'white';
        badge.textContent = `${sched.roleDisplay} (${sched.shift}: ${sched.hours})`;
        rolesContainer.appendChild(badge);
    });

    // Attendance State Check
    updateAttendanceUI(today, schedules);
    checkForUrgentTasks();

    // Muro de mensajes load
    loadMuroMessages();
}

function resolveTodaySchedules(empId, date) {
    const dateStr = formatDateString(date);
    const schedules = [];

    // 1. Check if there is an approved swap for today where this employee covers
    const approvedSwapsCover = swapRequests.filter(s => 
        s.request_date === dateStr && 
        s.to_employee_id === empId && 
        s.status === 'aprobado'
    );
    approvedSwapsCover.forEach(swap => {
        const originalOwner = employees.find(e => e.id === swap.from_employee_id);
        const roleInfo = Object.values(ROODS_ROLES).find(r => r.name === swap.role_name) || {
            key: 'swap-' + swap.id,
            taskRoles: [swap.role_name],
            hours: 'Especial'
        };
        schedules.push({
            roleKey: roleInfo.key,
            roleName: swap.role_name,
            roleDisplay: swap.role_name + ` (Cubre a ${originalOwner ? originalOwner.name : 'compañero'})`,
            shift: swap.shift,
            hours: roleInfo.hours || 'Especial',
            roles: roleInfo.taskRoles || [swap.role_name],
            isSwap: true
        });
    });

    // Get list of role names that the employee swapped out today
    const approvedSwapsRequester = swapRequests.filter(s => 
        s.request_date === dateStr && 
        s.from_employee_id === empId && 
        s.status === 'aprobado'
    );
    const swappedRoleNames = approvedSwapsRequester.map(s => s.role_name);

    // 2. Fetch from Weekly schedule
    const wednesdayDate = getStartOfWeekWednesday(date);
    const wednesdayStr = formatDateString(wednesdayDate);
    const weekSchedule = weeklyRoles[wednesdayStr];

    if (weekSchedule) {
        for (const [roleKey, assignedEmpId] of Object.entries(weekSchedule)) {
            if (assignedEmpId === empId) {
                const roleInfo = ROODS_ROLES[roleKey];
                if (roleInfo) {
                    // Check if this weekly role assignment was swapped out
                    if (swappedRoleNames.includes(roleInfo.name)) {
                        continue;
                    }
                    schedules.push({
                        roleKey: roleInfo.key,
                        roleName: roleInfo.name,
                        roleDisplay: roleInfo.name,
                        shift: roleInfo.shift,
                        hours: roleInfo.hours,
                        roles: roleInfo.taskRoles,
                        isSwap: false
                    });
                }
            }
        }
    }

    return schedules;
}

function resolveTodaySchedule(empId, date) {
    const list = resolveTodaySchedules(empId, date);
    return list.length > 0 ? list[0] : null;
}

function resolveRolesList(roleDisplay) {
    const matched = Object.values(ROODS_ROLES).find(r => r.name === roleDisplay);
    return matched ? matched.taskRoles : [];
}

// Attendance Logs checks
function updateAttendanceUI(today, schedules) {
    const todayStr = formatDateString(today);
    const container = document.getElementById('tasksContainer');
    const shiftsContainer = document.getElementById('checadorShiftsContainer');
    const statusDot = document.getElementById('attendanceStatusDot');
    
    if (!shiftsContainer) return;
    shiftsContainer.innerHTML = "";

    // Find all attendance logs for this user today
    const userTodayLogs = attendanceLogs.filter(l => 
        l.employee_id === currentUser.id && 
        l.date === todayStr
    );

    let isAnyActive = false;
    let activeRolesList = [];

    schedules.forEach(sched => {
        // Find logs specifically for this role
        const roleLogs = userTodayLogs.filter(l => 
            l.role_name === sched.roleName || 
            (userTodayLogs.length > 0 && !l.role_name && schedules.length === 1)
        );

        const checkIn = roleLogs.find(l => l.type === 'entrada');
        const checkOut = roleLogs.find(l => l.type === 'salida');

        // Create HTML row for this shift
        const shiftRow = document.createElement('div');
        shiftRow.style.display = 'flex';
        shiftRow.style.alignItems = 'center';
        shiftRow.style.justifyContent = 'space-between';
        shiftRow.style.padding = '12px 15px';
        shiftRow.style.margin = '8px 0';
        shiftRow.style.borderRadius = 'var(--border-radius-small)';
        shiftRow.style.background = 'rgba(255, 255, 255, 0.45)';
        shiftRow.style.border = '1px solid rgba(255, 255, 255, 0.3)';

        let statusText = "";
        let actionBtnHtml = "";

        if (!checkIn) {
            // Not checked in
            statusText = `<span style="font-size:0.85rem; color:var(--text-secondary);">⏳ Horario: ${sched.hours}</span>`;
            actionBtnHtml = `<button class="btn-primary" onclick="performCheckIn('${sched.roleKey}')" style="padding: 6px 14px; font-size:0.85rem; border:none; border-radius:8px;">Entrada 📥</button>`;
        } else if (checkIn && !checkOut) {
            // Active
            isAnyActive = true;
            activeRolesList = activeRolesList.concat(sched.roles);
            activeRolesList.push(sched.roleName);
            activeRolesList.push(sched.roleKey);
            statusText = `<span style="font-size:0.85rem; color:#388E3C; font-weight:700;">🟢 Entrada: ${checkIn.time}</span>`;
            actionBtnHtml = `<button class="btn-secondary" onclick="performCheckOut('${sched.roleKey}')" style="padding: 6px 14px; font-size:0.85rem; border:none; border-radius:8px;">Salida 📤</button>`;
        } else {
            // Checked out
            statusText = `<span style="font-size:0.85rem; color:var(--text-light); text-decoration: line-through;">🏁 Salida: ${checkOut.time} (Terminado)</span>`;
            actionBtnHtml = `<span style="font-size: 1.25rem;">✅</span>`;
        }

        shiftRow.innerHTML = `
            <div style="text-align: left;">
                <strong style="font-size:0.95rem; display:block;">${sched.roleDisplay}</strong>
                ${statusText}
            </div>
            <div>
                ${actionBtnHtml}
            </div>
        `;
        shiftsContainer.appendChild(shiftRow);
    });

    // Update global status dot
    if (isAnyActive) {
        statusDot.className = "status-indicator-dot active";
        container.classList.remove('locked');
        
        // Ensure daily tasks exist for active schedules
        schedules.forEach(sched => {
            generateDailyTasks(todayStr, sched);
        });

        // Render combined active checklists
        renderChecklistsForRoles(todayStr, activeRolesList, schedules);
    } else {
        statusDot.className = "status-indicator-dot";
        container.classList.add('locked');
        shiftsContainer.innerHTML += `<p class="attendance-message" style="margin-top: 10px; font-size: 0.85rem; color: var(--text-secondary);">🔒 Por favor checa tu entrada en tu turno activo para desbloquear tus tareas de hoy.</p>`;
    }
}

function performCheckIn(roleKey) {
    if (!roleKey) {
        const today = new Date();
        const schedules = resolveTodaySchedules(currentUser.id, today);
        if (schedules.length > 0) {
            roleKey = schedules[0].roleKey;
        } else {
            return;
        }
    }

    const roleInfo = ROODS_ROLES[roleKey];
    if (!roleInfo) return;

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
        role_name: roleInfo.name,
        shift: roleInfo.shift,
        timestamp: today.toISOString()
    };

    attendanceLogs.push(log);
    saveLocalDatabase();
    pushToCloudTable('roods_attendance', log);

    showNotification(`📥 Entrada registrada para ${roleInfo.name}.`);
    initEmployeeView();
}

function performCheckOut(roleKey) {
    if (!roleKey) {
        const today = new Date();
        const schedules = resolveTodaySchedules(currentUser.id, today);
        if (schedules.length > 0) {
            roleKey = schedules[0].roleKey;
        } else {
            return;
        }
    }

    const roleInfo = ROODS_ROLES[roleKey];
    if (!roleInfo) return;

    const today = new Date();
    const todayStr = formatDateString(today);

    // Check for pending mandatory tasks
    const empTasks = dailyTasks.filter(d => 
        d.date === todayStr && 
        d.shift === roleInfo.shift && 
        (roleInfo.taskRoles.includes(d.role_name) || d.role_name === roleInfo.name || d.role_name === roleInfo.key)
    );
    const pendingMandatory = empTasks.filter(t => t.Imprescindible === 'Si' && !t.completed);
    if (pendingMandatory.length > 0) {
        let taskNames = pendingMandatory.map(t => `• ${t.task_name}`).join("\n");
        alert(`⚠️ NO PUEDES REGISTRAR TU SALIDA.\n\nTienes tareas de seguridad o cierre imprescindibles pendientes para ${roleInfo.name}:\n\n${taskNames}\n\nPor favor, complétalas para poder checar tu salida.`);
        return;
    }

    if (!confirm(`¿Estás seguro de que deseas checar tu salida de ${roleInfo.name}?`)) {
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
        role_name: roleInfo.name,
        shift: roleInfo.shift,
        timestamp: today.toISOString()
    };

    attendanceLogs.push(log);
    saveLocalDatabase();
    pushToCloudTable('roods_attendance', log);

    showNotification(`📤 Salida registrada para ${roleInfo.name}. ¡Buen trabajo hoy!`);
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
    const existingTaskNames = new Set(existing.map(d => d.task_name));
    const newInstances = [];

    matchingTemplates.forEach(t => {
        if (!existingTaskNames.has(t.Tarea)) {
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
            newInstances.push(instance);
        }
    });

    if (newInstances.length > 0) {
        saveLocalDatabase();
        pushToCloudTable('roods_daily_tasks', newInstances);
    }
}

function renderChecklistsForRoles(dateStr, activeRolesList, schedules) {
    const myTasksList = document.getElementById('myTasksList');
    const collabTasksList = document.getElementById('collabTasksList');

    if (!myTasksList || !collabTasksList) return;

    myTasksList.innerHTML = "";
    collabTasksList.innerHTML = "";

    // Filter today's tasks for active shifts
    const activeShifts = [...new Set(schedules.map(s => s.shift))];
    const todayTasks = dailyTasks.filter(d => d.date === dateStr && activeShifts.includes(d.shift));

    // Individual tasks matching user's active roles
    const myTasks = todayTasks.filter(t => activeRolesList.includes(t.role_name));
    
    // Collaborative tasks for active shifts
    const collabTasks = todayTasks.filter(t => t.role_name === 'Colaborativa');

    // Render My Tasks
    if (myTasks.length === 0) {
        myTasksList.innerHTML = `<div class="empty-state"><span class="empty-state-icon">🎉</span>No tienes tareas individuales activas hoy</div>`;
    } else {
        myTasks.forEach(task => {
            const item = createTaskItemElement(task, false);
            myTasksList.appendChild(item);
        });
    }

    // Render Collaborative Tasks
    if (collabTasks.length === 0) {
        collabTasksList.innerHTML = '<div class="empty-state"><span class="empty-state-icon">📋</span>No hay tareas colaborativas asignadas para tus turnos hoy</div>';
    } else {
        collabTasks.forEach(task => {
            const item = createTaskItemElement(task, true);
            collabTasksList.appendChild(item);
        });
    }

    // Update Progress Bar
    updateTaskProgress(myTasks);
}

function renderChecklists(dateStr, schedule) {
    const today = new Date();
    const schedules = resolveTodaySchedules(currentUser.id, today);
    // Find active roles
    const userTodayLogs = attendanceLogs.filter(l => 
        l.employee_id === currentUser.id && 
        l.date === dateStr
    );
    let activeRolesList = [];
    schedules.forEach(sched => {
        const checkIn = userTodayLogs.find(l => l.role_name === sched.roleName && l.type === 'entrada');
        const checkOut = userTodayLogs.find(l => l.role_name === sched.roleName && l.type === 'salida');
        if (checkIn && !checkOut) {
            activeRolesList = activeRolesList.concat(sched.roles);
            activeRolesList.push(sched.roleName);
            activeRolesList.push(sched.roleKey);
        }
    });
    renderChecklistsForRoles(dateStr, activeRolesList, schedules);
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
    document.getElementById('tabMuroAvisos').className = `tab-btn ${tabId === 'muro-avisos' ? 'active' : ''}`;

    document.getElementById('contentMisTareas').className = `tab-content ${tabId === 'mis-tareas' ? 'active' : ''}`;
    document.getElementById('contentColaborativas').className = `tab-content ${tabId === 'colaborativas' ? 'active' : ''}`;
    document.getElementById('contentMuroAvisos').className = `tab-content ${tabId === 'muro-avisos' ? 'active' : ''}`;

    if (tabId === 'muro-avisos') {
        if (muroMessages.length > 0) {
            lastReadMuroTimestamp = muroMessages[muroMessages.length - 1].timestamp;
        } else {
            lastReadMuroTimestamp = new Date().toISOString();
        }
        localStorage.setItem('roods_last_read_muro', lastReadMuroTimestamp);
        updateMuroBadge();
    }
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
    if (tabId === 'muro-avisos-admin') {
        loadMuroMessages();
        if (muroMessages.length > 0) {
            lastReadMuroTimestamp = muroMessages[muroMessages.length - 1].timestamp;
        } else {
            lastReadMuroTimestamp = new Date().toISOString();
        }
        localStorage.setItem('roods_last_read_muro', lastReadMuroTimestamp);
        updateMuroBadge();
    }

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
    const todayEntries = attendanceLogs.filter(l => l.date === todayStr);
    let hasScheduled = false;

    // Check individual tasks progress for each active employee schedule
    employees.forEach(emp => {
        if (emp.is_admin) return;

        // Resolve today's schedules (could be multiple)
        const empSchedules = resolveTodaySchedules(emp.id, today);
        
        empSchedules.forEach(sched => {
            hasScheduled = true;
            
            // Check check-in status for this specific role
            const userLogs = todayEntries.filter(l => l.employee_id === emp.id);
            const checkIn = userLogs.find(l => l.role_name === sched.roleName && l.type === 'entrada');
            const checkOut = userLogs.find(l => l.role_name === sched.roleName && l.type === 'salida');

            let attendanceStatus = '<span class="text-orange">Pendiente de entrar</span>';
            if (checkIn && !checkOut) {
                attendanceStatus = `<span class="text-green">Activo (Entrada: ${checkIn.time})</span>`;
            } else if (checkOut) {
                attendanceStatus = `<span>Salió (${checkOut.time})</span>`;
            }

            // Calculate progress of daily tasks for this shift/role
            const empTasks = dailyTasks.filter(d => 
                d.date === todayStr && 
                d.shift === sched.shift && 
                (sched.roles.includes(d.role_name) || d.role_name === sched.roleName || d.role_name === sched.roleKey)
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
                    const deleteBtnHtml = `<span onclick="deleteActiveTask('${t.id}')" style="cursor: pointer; color: #ff5252; margin-left: 8px; font-weight: bold; font-size: 0.85rem;" title="Eliminar tarea para hoy">🗑️</span>`;
                    tasksDetailsHtml += `<div style="color: ${color}; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; text-decoration: ${textDecoration};">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; display: flex; align-items: center; gap: 4px;" title="${t.task_name}">${statusIcon} ${t.task_name}</span>
                        <div style="display: flex; align-items: center; text-decoration: none;">
                            <span style="font-weight: 600; flex-shrink: 0;">${timeText}</span>
                            ${deleteBtnHtml}
                        </div>
                    </div>`;
                });
                tasksDetailsHtml += `</div>`;
            }

            const photoSrc = emp.photo || '';
            const displayName = emp.nickname || emp.name;

            const card = document.createElement('div');
            card.className = "monitor-card";
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <div class="profile-pic-container" style="width: 36px; height: 36px; border-width: 1px;">
                        <img src="${photoSrc}" alt="Avatar" class="avatar-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23888888\'><path d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z\'/></svg>'">
                    </div>
                    <div>
                        <h4 style="margin:0; font-size:1rem;">${displayName}</h4>
                        <p class="monitor-meta" style="margin:0; font-size:0.75rem;">${sched.roleDisplay}</p>
                    </div>
                </div>
                <p class="monitor-meta" style="margin-top: 4px;">Turno ${sched.shift} (${sched.hours})</p>
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
                
                <!-- Quick Task Form -->
                <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed rgba(0,0,0,0.08); padding-top: 8px;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <input type="text" id="quickTaskName-${emp.id}-${sched.roleKey}" placeholder="Nueva tarea..." class="form-control" style="font-size:0.75rem; padding: 4px 8px; margin: 0; flex-grow: 1; height: 28px;">
                        <button class="btn-primary" onclick="addQuickTask(${emp.id}, '${sched.roleKey}', '${sched.shift}', '${sched.roleName}')" style="font-size:0.75rem; padding: 4px 10px; margin: 0; border: none; border-radius: 4px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end)); color: white; cursor: pointer;">➕</button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px; font-size: 0.7rem; color: var(--text-secondary);">
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; margin: 0; font-weight: normal;">
                            <input type="checkbox" id="quickTaskMandatory-${emp.id}-${sched.roleKey}" style="margin: 0; transform: scale(0.9);"> ⭐ ¿Obligatoria?
                        </label>
                        <span style="color: #ccc;">|</span>
                        <span style="font-style: italic; color: #888;">Sólo para hoy</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    });

    // Render collaborative shift progress dynamically for all active shifts today
    const activeShifts = [];
    employees.forEach(e => {
        if (e.is_admin) return;
        const schedules = resolveTodaySchedules(e.id, today);
        schedules.forEach(s => {
            if (!activeShifts.includes(s.shift)) {
                activeShifts.push(s.shift);
            }
        });
    });

    activeShifts.forEach(shift => {
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
                const deleteBtnHtml = `<span onclick="deleteActiveTask('${t.id}')" style="cursor: pointer; color: #ff5252; margin-left: 8px; font-weight: bold; font-size: 0.85rem;" title="Eliminar tarea para hoy">🗑️</span>`;
                collabDetailsHtml += `<div style="color: ${color}; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; text-decoration: ${textDecoration};">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; display: flex; align-items: center; gap: 4px;" title="${t.task_name}">${statusIcon} ${t.task_name}</span>
                    <div style="display: flex; align-items: center; text-decoration: none;">
                        <span style="font-weight: 600; flex-shrink: 0; font-size: 0.75rem;">${byText}${timeText}</span>
                        ${deleteBtnHtml}
                    </div>
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

            <!-- Quick Collab Task Form -->
            <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed rgba(0,0,0,0.08); padding-top: 8px;">
                <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="text" id="quickTaskName-collab-${shift}" placeholder="Nueva tarea colab..." class="form-control" style="font-size:0.75rem; padding: 4px 8px; margin: 0; flex-grow: 1; height: 28px;">
                    <button class="btn-primary" onclick="addQuickTask('collab', '${shift}', '${shift}', 'Colaborativa')" style="font-size:0.75rem; padding: 4px 10px; margin: 0; border: none; border-radius: 4px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; background: linear-gradient(135deg, #9c27b0, #e91e63); color: white; cursor: pointer;">➕</button>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; font-size: 0.7rem; color: var(--text-secondary);">
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; margin: 0; font-weight: normal;">
                        <input type="checkbox" id="quickTaskMandatory-collab-${shift}" style="margin: 0; transform: scale(0.9);"> ⭐ ¿Obligatoria?
                    </label>
                    <span style="color: #ccc;">|</span>
                    <span style="font-style: italic; color: #888;">Sólo para hoy</span>
                </div>
            </div>
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

    const selectIds = [
        'roleMatutinoCajeroBarista',
        'roleMatutinoCocinaBarista',
        'roleVespertinoCajero',
        'roleVespertinoBarista',
        'roleVespertinoCocina',
        'roleAuxAdministrativo',
        'roleApoyoCocina',
        'roleApoyoGeneral'
    ];
    
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
    if (id === 'roleMatutinoCajeroBarista') return 'matutinoCajeroBarista';
    if (id === 'roleMatutinoCocinaBarista') return 'matutinoCocinaBarista';
    if (id === 'roleVespertinoCajero') return 'vespertinoCajero';
    if (id === 'roleVespertinoBarista') return 'vespertinoBarista';
    if (id === 'roleVespertinoCocina') return 'vespertinoCocina';
    if (id === 'roleAuxAdministrativo') return 'auxAdministrativo';
    if (id === 'roleApoyoCocina') return 'apoyoCocina';
    if (id === 'roleApoyoGeneral') return 'apoyoGeneral';
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

    const selectIds = [
        'roleMatutinoCajeroBarista',
        'roleMatutinoCocinaBarista',
        'roleVespertinoCajero',
        'roleVespertinoBarista',
        'roleVespertinoCocina',
        'roleAuxAdministrativo',
        'roleApoyoCocina',
        'roleApoyoGeneral'
    ];
    
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
            
            // Clean object to avoid sending read-only or extra database properties (like created_at)
            const pushObj = {
                id: employees[idx].id,
                name: employees[idx].name,
                pin: employees[idx].pin,
                is_admin: employees[idx].is_admin,
                photo: employees[idx].photo || null,
                nickname: employees[idx].nickname || null
            };
            pushToCloudTable('roods_employees', pushObj);
        }
    } else {
        // Add Mode
        const newEmp = {
            id: Date.now(),
            name: nameVal,
            pin: pinVal,
            is_admin: isAdminVal,
            photo: null,
            nickname: null
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
            const { error } = await supabase.from('roods_daily_tasks').insert(newUrgentTask);
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

function refreshEmployeeTasksUI() {
    if (!currentUser || currentUser.is_admin) return;
    const today = new Date();
    const todayStr = formatDateString(today);
    const schedules = resolveTodaySchedules(currentUser.id, today);
    
    // Build active roles list from currently checked-in shifts
    const userTodayLogs = attendanceLogs.filter(l => 
        l.employee_id === currentUser.id && 
        l.date === todayStr
    );
    let activeRolesList = [];
    schedules.forEach(sched => {
        const checkIn = userTodayLogs.find(l => l.role_name === sched.roleName && l.type === 'entrada');
        const checkOut = userTodayLogs.find(l => l.role_name === sched.roleName && l.type === 'salida');
        if (checkIn && !checkOut) {
            activeRolesList = activeRolesList.concat(sched.roles);
            activeRolesList.push(sched.roleName);
            activeRolesList.push(sched.roleKey);
        }
    });
    
    renderChecklistsForRoles(todayStr, activeRolesList, schedules);
}

function subscribeToAllDailyTasks() {
    if (!supabase) return;
    
    supabase
        .channel('all-daily-tasks')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'roods_daily_tasks' },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newTask = payload.new;
                    if (!newTask) return;
                    
                    const mappedTask = {
                        id: newTask.id,
                        date: newTask.date,
                        shift: newTask.shift,
                        task_name: newTask.task_name,
                        role_name: newTask.role_name,
                        completed: newTask.completed,
                        completed_by_employee_id: newTask.completed_by_employee_id,
                        completed_by_name: newTask.completed_by_name,
                        completed_at: newTask.completed_at,
                        Imprescindible: newTask.Imprescindible || 'No',
                        Subtareas: newTask.Subtareas || '',
                        subtasks_state: newTask.subtasks_state || [],
                        is_urgent: newTask.is_urgent || false,
                        urgent_acknowledged: newTask.urgent_acknowledged || false
                    };
                    
                    if (!dailyTasks.some(d => d.id === mappedTask.id)) {
                        dailyTasks.push(mappedTask);
                        saveLocalDatabase();
                        
                        // If it's an urgent task, trigger alert
                        if (mappedTask.is_urgent) {
                            triggerUrgentAlertIfApplicable(mappedTask);
                        }
                        
                        if (currentUser) {
                            if (currentUser.is_admin) {
                                renderAdminMonitoreo();
                            } else {
                                refreshEmployeeTasksUI();
                            }
                        }
                    }
                } else if (payload.eventType === 'UPDATE') {
                    const updatedTask = payload.new;
                    if (!updatedTask) return;
                    
                    const mappedTask = {
                        id: updatedTask.id,
                        date: updatedTask.date,
                        shift: updatedTask.shift,
                        task_name: updatedTask.task_name,
                        role_name: updatedTask.role_name,
                        completed: updatedTask.completed,
                        completed_by_employee_id: updatedTask.completed_by_employee_id,
                        completed_by_name: updatedTask.completed_by_name,
                        completed_at: updatedTask.completed_at,
                        Imprescindible: updatedTask.Imprescindible || 'No',
                        Subtareas: updatedTask.Subtareas || '',
                        subtasks_state: updatedTask.subtasks_state || [],
                        is_urgent: updatedTask.is_urgent || false,
                        urgent_acknowledged: updatedTask.urgent_acknowledged || false
                    };
                    
                    const idx = dailyTasks.findIndex(d => d.id === mappedTask.id);
                    if (idx > -1) {
                        dailyTasks[idx] = mappedTask;
                        saveLocalDatabase();
                        
                        if (currentUser) {
                            if (currentUser.is_admin) {
                                renderAdminMonitoreo();
                            } else {
                                refreshEmployeeTasksUI();
                            }
                        }
                    }
                } else if (payload.eventType === 'DELETE') {
                    const oldTask = payload.old;
                    if (!oldTask || !oldTask.id) return;
                    
                    const idx = dailyTasks.findIndex(d => d.id == oldTask.id);
                    if (idx > -1) {
                        dailyTasks.splice(idx, 1);
                        saveLocalDatabase();
                        
                        if (currentUser) {
                            if (currentUser.is_admin) {
                                renderAdminMonitoreo();
                            } else {
                                refreshEmployeeTasksUI();
                            }
                        }
                    }
                }
            }
        )
        .subscribe();
}

async function deleteActiveTask(taskId) {
    if (!confirm("¿Estás seguro de que deseas eliminar esta tarea activa para el día de hoy?")) return;

    const idx = dailyTasks.findIndex(d => d.id === taskId);
    if (idx === -1) return;

    dailyTasks.splice(idx, 1);
    saveLocalDatabase();

    // Sincronizar borrado con Supabase
    if (supabase) {
        try {
            const { error } = await supabase
                .from('roods_daily_tasks')
                .delete()
                .eq('id', taskId);
            if (error) throw error;
            showNotification("🗑️ Tarea eliminada correctamente.");
        } catch (e) {
            console.error("Failed to delete task from Supabase:", e);
            showNotification("⚠️ Tarea eliminada localmente (Offline).");
        }
    } else {
        showNotification("🗑️ Tarea eliminada localmente.");
    }

    renderAdminMonitoreo();
}

async function addQuickTask(empId, roleKey, shift, roleName) {
    const inputId = empId === 'collab' ? `quickTaskName-collab-${shift}` : `quickTaskName-${empId}-${roleKey}`;
    const checkId = empId === 'collab' ? `quickTaskMandatory-collab-${shift}` : `quickTaskMandatory-${empId}-${roleKey}`;

    const input = document.getElementById(inputId);
    const check = document.getElementById(checkId);
    
    if (!input) return;
    const taskName = input.value.trim();
    if (!taskName) {
        alert("Por favor escribe la descripción de la tarea.");
        return;
    }

    const isMandatory = check && check.checked ? "Si" : "No";
    const todayStr = formatDateString(new Date());

    const newQuickTask = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        date: todayStr,
        shift: shift,
        role_name: roleName,
        task_name: taskName,
        completed: false,
        completed_by_employee_id: null,
        completed_by_name: null,
        completed_at: null,
        Imprescindible: isMandatory,
        Subtareas: "",
        subtasks_state: [],
        is_urgent: false,
        urgent_acknowledged: false
    };

    dailyTasks.push(newQuickTask);
    saveLocalDatabase();

    // Clear inputs
    input.value = "";
    if (check) check.checked = false;

    showNotification("➕ Tarea agregada para hoy.");
    renderAdminMonitoreo();

    if (supabase) {
        try {
            const { error } = await supabase.from('roods_daily_tasks').insert(newQuickTask);
            if (error) throw error;
        } catch (e) {
            console.error("Failed to sync quick task to Supabase:", e);
            showNotification("⚠️ Tarea agregada localmente (Offline).");
        }
    }
}

// --- PROFILE MODAL ACTIONS ---
function openProfileModal() {
    document.getElementById('profileNickname').value = currentUser.nickname || currentUser.name;
    const modalPic = document.getElementById('profileModalPic');
    if (modalPic) {
        modalPic.src = currentUser.photo || '';
    }
    document.getElementById('profileModal').classList.remove('hidden');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.add('hidden');
}

function triggerProfileUpload() {
    document.getElementById('profilePicInput').click();
}

function handleProfilePicChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    showNotification("Procesando y comprimiendo foto...");

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 120;
            const MAX_HEIGHT = 120;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compresión de imagen Base64 (JPEG, 0.7 de calidad)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            // Actualizar vista previa
            document.getElementById('profileModalPic').src = dataUrl;
            
            currentUser.tempPhoto = dataUrl;
            showNotification("📷 Foto cargada. Recuerda presionar Guardar.");
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function submitProfileForm(event) {
    event.preventDefault();
    const nickname = document.getElementById('profileNickname').value.trim();
    if (!nickname) return;

    currentUser.nickname = nickname;
    if (currentUser.tempPhoto) {
        currentUser.photo = currentUser.tempPhoto;
        delete currentUser.tempPhoto;
    }

    // Actualizar en array local de empleados
    const idx = employees.findIndex(e => e.id === currentUser.id);
    if (idx > -1) {
        employees[idx].nickname = currentUser.nickname;
        employees[idx].photo = currentUser.photo;
    }

    saveLocalDatabase();
    closeProfileModal();
    
    // Recargar vista
    initEmployeeView();
    showNotification("💾 Perfil guardado correctamente.");

    // Sincronizar a Supabase
    if (supabase) {
        try {
            const pushObj = {
                id: currentUser.id,
                name: currentUser.name,
                pin: currentUser.pin,
                is_admin: currentUser.is_admin,
                photo: currentUser.photo || null,
                nickname: currentUser.nickname || null
            };
            const { error } = await supabase.from('roods_employees').upsert(pushObj);
            if (error) throw error;
        } catch (e) {
            console.error("Failed to sync profile to cloud:", e);
            showNotification(`⚠️ Error al sincronizar perfil: ${e.message || JSON.stringify(e)}`, 8000);
        }
    }
}

// --- MURO DE AVISOS REAL-TIME ---
async function loadMuroMessages() {
    const list = document.getElementById('muroMessagesList');
    const adminList = document.getElementById('adminMuroMessagesList');
    if (!list && !adminList) return;

    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('roods_messages')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(40);
            if (!error && data) {
                muroMessages = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                localStorage.setItem('roods_muro_messages', JSON.stringify(muroMessages));
            }
        } catch (e) {
            console.warn("Could not load messages from Supabase, loading local cache:", e);
        }
    }

    if (muroMessages.length === 0) {
        muroMessages = JSON.parse(localStorage.getItem('roods_muro_messages')) || [];
    }

    renderMuroMessages();
    updateMuroBadge();
}

function renderMuroMessages() {
    const list = document.getElementById('muroMessagesList');
    const adminList = document.getElementById('adminMuroMessagesList');
    if (!list && !adminList) return;

    let listHtml = "";
    if (muroMessages.length === 0) {
        listHtml = '<div class="empty-state" style="padding:15px; font-size:0.85rem;"><span class="empty-state-icon" style="font-size:1.5rem;">💬</span>No hay avisos recientes. ¡Escribe el primero!</div>';
    } else {
        muroMessages.forEach(msg => {
            const sender = employees.find(e => e.id === msg.employee_id || e.name === msg.employee_name);
            const photoSrc = (sender && sender.photo) ? sender.photo : '';
            const displayName = (sender && sender.nickname) ? sender.nickname : msg.employee_name;
            const timeStr = formatTimeString(msg.timestamp);

            listHtml += `
                <div class="muro-msg-item">
                    <div class="profile-pic-container" style="width: 32px; height: 32px; border-width: 1px;">
                        <img src="${photoSrc}" alt="Avatar" class="avatar-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23888888\'><path d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z\'/></svg>'">
                    </div>
                    <div class="muro-msg-content">
                        <div class="muro-msg-header">
                            <span class="muro-msg-sender">${displayName}</span>
                            <span class="muro-msg-time">${timeStr}</span>
                        </div>
                        <span class="muro-msg-text">${msg.message}</span>
                    </div>
                </div>
            `;
        });
    }

    if (list) {
        list.innerHTML = listHtml;
        list.scrollTop = list.scrollHeight;
    }
    if (adminList) {
        adminList.innerHTML = listHtml;
        adminList.scrollTop = adminList.scrollHeight;
    }
}

function updateMuroBadge() {
    const hasUnread = muroMessages.some(msg => msg.timestamp > lastReadMuroTimestamp);
    
    const empDot = document.getElementById('muroBadgeDot');
    const adminDot = document.getElementById('adminMuroBadgeDot');
    
    if (hasUnread) {
        if (empDot && currentTaskTab !== 'muro-avisos') empDot.classList.remove('hidden');
        if (adminDot && currentAdminTab !== 'muro-avisos-admin') adminDot.classList.remove('hidden');
    } else {
        if (empDot) empDot.classList.add('hidden');
        if (adminDot) adminDot.classList.add('hidden');
    }
}

async function sendMuroMessage(event) {
    event.preventDefault();
    const input = document.getElementById('muroMessageInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    await pushNewMuroMessage(text);
}

async function sendAdminMuroMessage(event) {
    event.preventDefault();
    const input = document.getElementById('adminMuroMessageInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    await pushNewMuroMessage(text);
}

async function pushNewMuroMessage(text) {
    const newMsg = {
        id: Date.now(),
        employee_id: currentUser.id,
        employee_name: currentUser.nickname || currentUser.name,
        message: text,
        timestamp: new Date().toISOString()
    };

    muroMessages.push(newMsg);
    renderMuroMessages();
    localStorage.setItem('roods_muro_messages', JSON.stringify(muroMessages));

    // Update timestamp for sender to mark as read
    lastReadMuroTimestamp = newMsg.timestamp;
    localStorage.setItem('roods_last_read_muro', lastReadMuroTimestamp);
    updateMuroBadge();

    if (supabase) {
        try {
            const dbObj = {
                employee_id: newMsg.employee_id,
                employee_name: newMsg.employee_name,
                message: newMsg.message
            };
            const { error } = await supabase.from('roods_messages').insert(dbObj);
            if (error) throw error;
        } catch (e) {
            console.error("Failed to post message to Supabase:", e);
            showNotification("⚠️ Mensaje guardado localmente (Offline).");
        }
    }
}

function subscribeToMuroMessages() {
    if (!supabase) return;
    
    supabase
        .channel('muro-messages')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'roods_messages' },
            (payload) => {
                const newMsg = payload.new;
                if (!newMsg) return;

                if (!muroMessages.some(m => m.id === newMsg.id)) {
                    muroMessages.push(newMsg);
                    muroMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    renderMuroMessages();
                    localStorage.setItem('roods_muro_messages', JSON.stringify(muroMessages));
                    updateMuroBadge();
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
                subscribeToAllDailyTasks();
                subscribeToMuroMessages();
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
