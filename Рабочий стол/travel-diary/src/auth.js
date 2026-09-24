// src/auth.js — модуль авторизации пользователей
// Отвечает за регистрацию, вход, выход и хранение сессии.

const Auth = (() => {
    const USERS_KEY = 'travel_users';
    const SESSION_KEY = 'travel_session';

    /**
     * Хэширует пароль через SHA-256 (Web Crypto API).
     * @param {string} password - пароль в открытом виде
     * @returns {Promise<string>} hex-строка с хэшем
     */
    async function hashPassword(password) {
        const enc = new TextEncoder();
        const data = enc.encode(password + '::travel_salt_v1');
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /** @returns {Array<Object>} список всех пользователей */
    function getUsers() {
        try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
        catch { return []; }
    }

    /** Сохраняет список пользователей в localStorage */
    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    /**
     * Регистрирует нового пользователя.
     * @param {string} name
     * @param {string} email
     * @param {string} password
     * @returns {Promise<Object>} созданный пользователь
     */
    async function register(name, email, password) {
        email = email.trim().toLowerCase();
        name = name.trim();
        if (!name || !email || !password) throw new Error('Заполните все поля');
        if (password.length < 4) throw new Error('Пароль должен быть минимум 4 символа');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Некорректный email');

        const users = getUsers();
        if (users.some(u => u.email === email)) {
            throw new Error('Пользователь с таким email уже существует');
        }
        const user = {
            id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name, email,
            passwordHash: await hashPassword(password),
            createdAt: new Date().toISOString()
        };
        users.push(user);
        saveUsers(users);
        setSession(user.id);
        return user;
    }

    /**
     * Вход по email и паролю.
     * @returns {Promise<Object>} пользователь
     */
    async function login(email, password) {
        email = email.trim().toLowerCase();
        const users = getUsers();
        const user = users.find(u => u.email === email);
        if (!user) throw new Error('Пользователь не найден');
        const hash = await hashPassword(password);
        if (hash !== user.passwordHash) throw new Error('Неверный пароль');
        setSession(user.id);
        return user;
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }

    function setSession(userId) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId,
            loginAt: new Date().toISOString()
        }));
    }

    /** @returns {Object|null} текущий авторизованный пользователь */
    function currentUser() {
        try {
            const s = JSON.parse(localStorage.getItem(SESSION_KEY));
            if (!s) return null;
            return getUsers().find(u => u.id === s.userId) || null;
        } catch { return null; }
    }

    function isLoggedIn() {
        return !!currentUser();
    }

    return { register, login, logout, currentUser, isLoggedIn };
})();