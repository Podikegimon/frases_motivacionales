document.addEventListener('DOMContentLoaded', () => {
    // ------------- Elementos del DOM -------------
    const splashScreen = document.getElementById('splash-screen');
    const loginContainer = document.getElementById('login-container');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('login-message');
    const logoutLink = document.getElementById('logout-link');
    const yearSpan = document.getElementById('year');

    // Supabase credentials
    const SUPABASE_URL = 'https://gvynqwjjtqxyubizgvgf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eW5xd2pqdHF4eXViaXpndmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODYyMTksImV4cCI6MjA3NTk2MjIxOX0.4dLzZdowsRrUN9PbBh_rWpvTztAWCqQFKu-tBKxkdM4';
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ------------- Estado de la Aplicación -------------
    // **CAMBIO:** Variable para almacenar el usuario "logueado".
    // Para este demo, usaremos un objeto estático con un UUID válido.
    // En una app real, esto vendría de `sb.auth.getUser()`.
    let currentUser = null;

    // ------------- Lógica de la Aplicación -------------

    // 1. Manejo de la pantalla de carga (Splash Screen)
    setTimeout(() => {
        splashScreen.classList.add('fade-out');
        loginContainer.classList.remove('hidden');
    }, 2000);

    // 2. Manejo del Login
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        if (email === 'admin@gmail.com' && password === '1234') {
            // **CAMBIO:** Se asigna un usuario mock al iniciar sesión.
            // Este UUID es un ejemplo, pero debe ser consistente.
            currentUser = {
                id: '8d5c9f5c-9c9d-4e2b-8b8e-1b1b1b1b1b1b',
                email: 'admin@gmail.com'
            };

            loginContainer.classList.add('hidden');
            mainApp.classList.remove('hidden');
            initializeApp();
        } else {
            loginMessage.textContent = 'Correo o contraseña incorrectos.';
            loginMessage.classList.add('error');
        }
    });
    
    // 3. Manejo del Logout
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        location.reload();
    });

    // 4. Navegación SPA
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    function activateSection(sectionId) {
        sections.forEach(s => s.classList.toggle('active', s.id === sectionId));
        navLinks.forEach(a => a.classList.toggle('active', a.dataset.section === sectionId));
    }

    function handleNavigation() {
        const hash = (location.hash || '#inicio').substring(1);
        const validSections = ['inicio', 'frases', 'categorias', 'usuarios', 'likes', 'nosotros', 'contacto'];
        activateSection(validSections.includes(hash) ? hash : 'inicio');
    }

    navLinks.forEach(a => {
        if (a.id !== 'logout-link') {
            a.addEventListener('click', () => { window.location.hash = a.dataset.section; });
        }
    });

    window.addEventListener('hashchange', handleNavigation);
    
    // 5. Inicialización de la Aplicación Principal
    function initializeApp() {
        if (yearSpan) yearSpan.textContent = new Date().getFullYear();
        initSupabase();
        handleNavigation();
    }
    
    // ------------- LÓGICA DE SUPABASE -------------
    
    const frasesContainer = document.getElementById('frases-container');
    const fraseForm = document.getElementById('frase-form');
    // ... (resto de tus variables de formulario)

    const dataTables = { frases: null, categorias: null, usuarios: null, likes: null };
    
    async function initSupabase() {
        await getFrases();
        await getCategories();
        await renderUsuariosTable();
        await getLikes();
        setupActionListeners();
        setupRealtime();
    }
    
    function setupRealtime() {
      // Escuchamos cambios en 'frases' para actualizar likes en tiempo real
      sb.channel('public:frases')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'frases' }, getFrases)
        .subscribe();
      sb.channel('public:categorias')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, getCategories)
        .subscribe();
    }
    
    function initializeDataTable(tableId, section, options = {}) {
        const table = $(`#${tableId}`);
        if (dataTables[section]) dataTables[section].destroy();
        dataTables[section] = table.DataTable({
            language: { url: 'https://cdn.datatables.net/plug-ins/2.0.8/i18n/es-ES.json' },
            responsive: true,
            ...options
        });
    }

    async function getFrases() {
      await renderFraseCards();
      await renderFrasesTable();
    }
    
    async function renderFraseCards() {
        if (!frasesContainer || !currentUser) return;

        // **CAMBIO:** Modificamos la consulta para traer la información de los likes
        // de cada frase y saber si el usuario actual ya le dio "like".
        let { data: frases, error } = await sb.from('frases')
            .select(`
                id, texto, autor, fecha_creacion, total_likes,
                categorias ( id, nombre ),
                likes ( usuario_id )
            `)
            .order('fecha_creacion', { ascending: false });

        if (error) { console.error('Error fetching frases:', error); return; }

        frasesContainer.innerHTML = frases.map(frase => {
            // Verificamos si en la lista de likes de esta frase está nuestro usuario.
            const userHasLiked = frase.likes.some(like => like.usuario_id === currentUser.id);
            
            return `
            <div class="frase-card">
              <p class="frase-text">"${frase.texto}"</p>
              <div class="frase-meta">
                <span class="badge">${frase.categorias?.nombre || 'General'}</span>
                
                <button 
                  class="like-btn ${userHasLiked ? 'liked' : ''}" 
                  data-id="${frase.id}" 
                  data-liked="${userHasLiked}">
                  ❤️ <span class="like-count">${frase.total_likes || 0}</span>
                </button>
              </div>
              <div class="frase-submeta muted">#${frase.id} · ${new Date(frase.fecha_creacion).toLocaleDateString()}</div>
            </div>
        `}).join('');
    }

    // ... (Tu función renderFrasesTable y las demás se mantienen igual)
    async function renderFrasesTable() {
        const frasesTableBody = document.querySelector('#frases-table tbody');
        if (!frasesTableBody) return;
        let { data: frases, error } = await sb.from('frases').select(`id, texto, autor, total_likes, fecha_creacion, categorias(id, nombre)`).order('id', { ascending: true });
        if (error) { console.error('Error fetching frases table:', error); return; }

        frasesTableBody.innerHTML = frases.map(f => `
            <tr>
                <td>${f.id}</td><td>${f.texto}</td><td>${f.autor || ''}</td>
                <td>${f.categorias?.nombre || ''}</td><td>${f.total_likes}</td>
                <td>${new Date(f.fecha_creacion).toLocaleString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit edit-frase" data-id="${f.id}" data-texto="${f.texto}" data-autor="${f.autor || ''}" data-categoria-id="${f.categorias?.id || ''}">✏️</button>
                        <button class="action-btn delete delete-frase" data-id="${f.id}">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
        initializeDataTable('frases-table', 'frases');
    }

    async function getCategories() {
        const { data: categories, error } = await sb.from('categorias').select('*').order('nombre');
        if (error) { console.error('Error fetching categories:', error); return; }
        document.getElementById('frase-category').innerHTML = '<option value="">-- Sin categoría --</option>' + categories.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        const categoryTableBody = document.querySelector('#category-table tbody');
        if(categoryTableBody) {
          categoryTableBody.innerHTML = categories.map(c => `
              <tr>
                  <td>${c.id}</td><td>${c.nombre}</td><td>${c.descripcion || ''}</td>
                  <td>
                      <div class="action-buttons">
                          <button class="action-btn edit edit-category" data-id="${c.id}" data-nombre="${c.nombre}">✏️</button>
                          <button class="action-btn delete delete-category" data-id="${c.id}">🗑️</button>
                      </div>
                  </td>
              </tr>
          `).join('');
          initializeDataTable('category-table', 'categorias');
        }
    }
    
    async function renderUsuariosTable() {
        const usersTableBody = document.querySelector('#users-table tbody');
        if (!usersTableBody) return;
        usersTableBody.innerHTML = '';
        initializeDataTable('users-table', 'usuarios');
    }
    
    async function getLikes() {
        const likesTableBody = document.querySelector('#likes-table tbody');
        if (!likesTableBody) return;
        const { data: likes, error } = await sb.from('likes').select(`id, fecha_like, frases(texto), usuarios(nombre_usuario)`).order('fecha_like', { ascending: false });
        if (error) { console.error('Error fetching likes:', error); return; }
        
        likesTableBody.innerHTML = likes.map(l => `
            <tr>
                <td>${l.id}</td><td>${l.frases?.texto?.substring(0, 40) + '...' || 'N/A'}</td>
                <td>${l.usuarios?.nombre_usuario || 'N/A'}</td><td>${new Date(l.fecha_like).toLocaleString()}</td>
            </tr>
        `).join('');
        initializeDataTable('likes-table', 'likes');
    }

    fraseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('frase-id').value || null;
      const data = {
        texto: document.getElementById('frase-text').value,
        autor: document.getElementById('frase-author').value,
        categoria_id: document.getElementById('frase-category').value || null
      };
      let query = id ? sb.from('frases').update(data).eq('id', id) : sb.from('frases').insert([data]);
      const { error } = await query;
      if (error) console.error('Error saving frase:', error); else fraseForm.reset();
    });
    
    document.getElementById('category-form').addEventListener('submit', async(e) => {
        e.preventDefault();
        const id = document.getElementById('category-id').value || null;
        const data = { nombre: document.getElementById('category-name').value };
        let query = id ? sb.from('categorias').update(data).eq('id', id) : sb.from('categorias').insert([data]);
        const { error } = await query;
        if (error) console.error('Error saving category:', error); else document.getElementById('category-form').reset();
    });

    // **CAMBIO:** Se añade la lógica para manejar el clic en el botón de "like".
    async function handleLikeClick(e) {
        const likeButton = e.target.closest('.like-btn');
        if (!likeButton || !currentUser) return;

        const fraseId = likeButton.dataset.id;
        const userHasLiked = likeButton.dataset.liked === 'true';

        // Lógica para quitar el like
        if (userHasLiked) {
            const { error } = await sb.from('likes')
                .delete()
                .match({ usuario_id: currentUser.id, frase_id: fraseId });
            
            if (error) console.error('Error removing like:', error);

        // Lógica para agregar el like
        } else {
            const { error } = await sb.from('likes')
                .insert({ usuario_id: currentUser.id, frase_id: fraseId });

            if (error) console.error('Error adding like:', error);
        }
        
        // No es necesario refrescar manualmente, la suscripción de Realtime
        // detectará el cambio en la tabla `frases` (vía trigger) y
        // llamará a `renderFraseCards` automáticamente.
    }

    function setupActionListeners() {
      // **CAMBIO:** Se adjunta el nuevo manejador de likes al contenedor.
      frasesContainer.addEventListener('click', handleLikeClick);
        
      document.body.addEventListener('click', async (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;
        
        const id = target.dataset.id;
        
        if (target.classList.contains('edit-frase')) {
          document.getElementById('frase-id').value = id;
          document.getElementById('frase-text').value = target.dataset.texto;
          document.getElementById('frase-author').value = target.dataset.autor;
          document.getElementById('frase-category').value = target.dataset.categoriaId;
          window.location.hash = 'frases';
          document.getElementById('frase-text').focus();
        }
        
        if (target.classList.contains('delete-frase')) {
          if (confirm(`¿Eliminar frase ID ${id}?`)) await sb.from('frases').delete().eq('id', id);
        }

        if (target.classList.contains('edit-category')) {
          document.getElementById('category-id').value = id;
          document.getElementById('category-name').value = target.dataset.nombre;
          window.location.hash = 'categorias';
          document.getElementById('category-name').focus();
        }
        
        if (target.classList.contains('delete-category')) {
          if (confirm(`¿Eliminar categoría ID ${id}?`)) await sb.from('categorias').delete().eq('id', id);
        }
      });
    }
});