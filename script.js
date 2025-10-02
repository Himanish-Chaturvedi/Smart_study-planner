//  DOM Element References
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal'); // Targets the <dialog>
const closeModalBtn = document.getElementById('close-modal-btn');
const taskForm = document.getElementById('task-form');
const taskListDiv = document.getElementById('task-list');
const noTasksMessage = document.getElementById('no-tasks-message');
const progressContainer = document.getElementById('progress-container');

const filterPriority = document.getElementById('filter-priority');
const filterCategory = document.getElementById('filter-category');

// Form input references
const taskIdInput = document.getElementById('task-id');
const taskNameInput = document.getElementById('task-name');
const taskCategoryInput = document.getElementById('task-category');
const dueDateInput = document.getElementById('due-date');
const dueTimeInput = document.getElementById('due-time'); 
const priorityInput = document.getElementById('priority');

let tasks = [];
let notifiedTasks = new Set(); // Tracks tasks for which a notification has been sent

// CORE LOCAL STORAGE FUNCTIONS 

function loadTasks() {
    const storedTasks = localStorage.getItem('studyTasks');
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
        tasks = tasks.map(task => ({
            ...task,
            status: task.status || 'pending',
            dueTime: task.dueTime || '' 
        }));
    }
}

function saveTasks() {
    localStorage.setItem('studyTasks', JSON.stringify(tasks));
}

//  NOTIFICATION LOGIC 

/* Requests permission for desktop notifications.*/
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission();
    }
}

/**
 * Checks for tasks due soon and triggers browser notifications.
 */
function checkReminders() {
    const now = new Date();
    // Check for tasks due in the next 15 minutes (900,000 milliseconds)
    const reminderWindow = 15 * 60 * 1000; 

    tasks.forEach(task => {
        // Only check pending tasks that have a time set and haven't been notified yet
        if (task.status !== 'completed' && task.dueTime && !notifiedTasks.has(task.id)) {
            
            const [hours, minutes] = task.dueTime.split(':').map(Number);
            const taskDateTime = new Date(task.dueDate);
            taskDateTime.setHours(hours, minutes, 0, 0);

            const timeDifference = taskDateTime.getTime() - now.getTime();

            // Check if the task is due now or within the reminder window, but not already passed
            if (timeDifference > 0 && timeDifference <= reminderWindow) {
                
                if (Notification.permission === 'granted') {
                    new Notification('🚨 Study Reminder: Due Soon!', {
                        body: `${task.name} (${task.category}) is due at ${task.dueTime}! Priority: ${task.priority}`,
                        icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png' // Placeholder icon
                    });
                    // Add to the set to prevent immediate re-notification
                    notifiedTasks.add(task.id); 
                }
            }
        }
    });
}

//  SMART LOGIC FUNCTIONS (Progress, Overdue, Filtering)

function isOverdue(task) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const taskDate = new Date(task.dueDate);
    taskDate.setHours(0, 0, 0, 0); 
    return taskDate < today && task.status !== 'completed';
}

function updateCategoryFilter() {
    const categories = new Set(tasks.map(task => task.category).filter(c => c));
    const currentFilterValue = filterCategory.value;

    filterCategory.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(category => {
        if (category) {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filterCategory.appendChild(option);
        }
    });
    if (categories.has(currentFilterValue) || currentFilterValue === 'all') {
        filterCategory.value = currentFilterValue;
    }
}

function getCategoryProgress() {
    const progressMap = {};
    tasks.forEach(task => {
        const cat = task.category || 'Uncategorized';
        if (!progressMap[cat]) {
            progressMap[cat] = { total: 0, completed: 0 };
        }
        progressMap[cat].total++;
        if (task.status === 'completed') {
            progressMap[cat].completed++;
        }
    });
    return Object.keys(progressMap).map(category => {
        const { total, completed } = progressMap[category];
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { category, total, completed, percent };
    });
}

function updateProgressGauges() {
    progressContainer.innerHTML = '';
    const progressData = getCategoryProgress();
    if (progressData.length === 0) {
        progressContainer.innerHTML = '<p class="status-message">Create tasks to view progress rings.</p>';
        return;
    }
    progressData.forEach(data => {
        const ringCard = document.createElement('div');
        ringCard.classList.add('progress-ring-card');
        let ringColor = 'var(--primary-color)';
        if (data.percent === 100) ringColor = 'var(--low-priority-color)'; 
        const gradientStyle = `conic-gradient(${ringColor} ${data.percent}%, #eee ${data.percent}%)`;
        ringCard.innerHTML = `
            <div class="progress-ring" style="background: ${gradientStyle};">
                ${data.percent}%
            </div>
            <p title="${data.category}">${data.category} (${data.completed}/${data.total})</p>
        `;
        progressContainer.appendChild(ringCard);
    });
}

function renderTasks() {
    taskListDiv.innerHTML = '';
    
    const selectedPriority = filterPriority.value;
    const selectedCategory = filterCategory.value;

    const filteredTasks = tasks.filter(task => {
        const priorityMatch = selectedPriority === 'all' || task.priority === selectedPriority;
        const categoryMatch = selectedCategory === 'all' || task.category === selectedCategory;
        return priorityMatch && categoryMatch;
    });

    if (filteredTasks.length === 0) {
        noTasksMessage.style.display = 'block';
    } else {
        noTasksMessage.style.display = 'none';
    }

    // Sort Logic: Overdue (0) > Pending (1) > Completed (2). Within status, sort by date.
    filteredTasks.sort((a, b) => {
        const aStatus = a.status === 'completed' ? 2 : (isOverdue(a) ? 0 : 1);
        const bStatus = b.status === 'completed' ? 2 : (isOverdue(b) ? 0 : 1);
        
        if (aStatus !== bStatus) return aStatus - bStatus; 
        return new Date(a.dueDate) - new Date(b.dueDate); 
    });

    filteredTasks.forEach(task => {
        const formattedDate = new Date(task.dueDate).toLocaleDateString();
        const timeDisplay = task.dueTime ? ` @ ${task.dueTime}` : ''; 
        const isCompleted = task.status === 'completed';
        const overdueStatus = isOverdue(task);

        const taskCard = document.createElement('div');
        taskCard.classList.add('task-card', `priority-${task.priority}`);
        if (isCompleted) taskCard.classList.add('completed');
        if (overdueStatus) taskCard.classList.add('overdue');

        taskCard.innerHTML = `
            <div class="task-info">
                <input type="checkbox" class="task-complete-toggle" data-id="${task.id}" ${isCompleted ? 'checked' : ''}>
                <div class="task-details">
                    <h4 title="${task.name}">${task.name}</h4>
                    <small>
                        Category: **${task.category}** | 
                        Due: ${formattedDate}${timeDisplay} ${overdueStatus ? '(OVERDUE)' : ''} | 
                        Priority: ${task.priority}
                    </small>
                </div>
            </div>
            <div class="task-actions">
                <button class="edit-btn" data-id="${task.id}">Edit</button>
            </div>
        `;

        taskListDiv.appendChild(taskCard);
    });
    
    updateProgressGauges();
    attachTaskEventListeners();
}

function attachTaskEventListeners() {
    document.querySelectorAll('.task-complete-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const taskId = e.target.getAttribute('data-id');
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.status = e.target.checked ? 'completed' : 'pending';
                notifiedTasks.delete(task.id); 
                saveTasks();
                renderTasks(); 
            }
        });
    });

    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const taskId = e.target.getAttribute('data-id');
            openEditModal(taskId);
        });
    });
}

function openEditModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        taskIdInput.value = task.id;
        taskNameInput.value = task.name;
        taskCategoryInput.value = task.category;
        dueDateInput.value = task.dueDate;
        dueTimeInput.value = task.dueTime; 
        priorityInput.value = task.priority;
        
    
        taskModal.setAttribute('open', '');
        taskModal.style.display = 'block'; 
        document.body.classList.add('modal-open');
    }
}


// EVENT HANDLERS (Modal Toggles)

// 1. Open Modal (New Task)
addTaskBtn.addEventListener('click', () => {
    taskForm.reset();
    taskIdInput.value = '';
    
    // FIXED MODAL OPENING
    taskModal.setAttribute('open', '');
    taskModal.style.display = 'block'; 
    document.body.classList.add('modal-open');
});

// 2. Close Modal (Cancel Button)
closeModalBtn.addEventListener('click', () => {
    // FIXED MODAL CLOSING
    taskModal.removeAttribute('open');
    taskModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    taskForm.reset();
});

// 3. Form Submission
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = taskIdInput.value;
    const name = taskNameInput.value;
    const category = taskCategoryInput.value.trim();
    const dueDate = dueDateInput.value;
    const dueTime = dueTimeInput.value; 
    const priority = priorityInput.value;
    
    if (id) {
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            tasks[taskIndex] = {
                ...tasks[taskIndex], 
                name,
                category,
                dueDate,
                dueTime,
                priority
            };
        }
    } else {
        const newTask = {
            id: Date.now().toString(), 
            name,
            category,
            dueDate,
            dueTime,
            priority,
            status: 'pending'
        };
        tasks.push(newTask);
    }

    notifiedTasks.clear(); 
    saveTasks();
    updateCategoryFilter();
    renderTasks();

    // FIXED MODAL CLOSING
    taskModal.removeAttribute('open');
    taskModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    taskForm.reset();
});

// 4. Filtering
filterPriority.addEventListener('change', renderTasks);
filterCategory.addEventListener('change', renderTasks);


// INITIALIZATION

loadTasks();
updateCategoryFilter();
renderTasks();

// Ask for notification permission immediately
requestNotificationPermission();

// Set up the interval to check reminders every 30 seconds
setInterval(checkReminders, 30000);