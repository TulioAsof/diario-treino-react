import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from './firebaseConfig'; // Importamos a config do Firebase
import { 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut 
} from 'firebase/auth';
import { 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    onSnapshot,
    query,
    orderBy,
    getDoc,
    setDoc
} from 'firebase/firestore';
import { generateContent } from './gemini';

// --- DADOS DEFAULT (PARA NOVOS UTILIZADORES) ---
const DEFAULT_PLANO_TREINO = {
    "Push A (Peito/Ombro)": [{ 'exercicio': 'Supino Reto', 'series': 4, 'reps': '6-10' }, { 'exercicio': 'Supino Inclinado', 'series': 3, 'reps': '8-12' }, { 'exercicio': 'Desenvolvimento Ombros', 'series': 3, 'reps': '8-12' }, { 'exercicio': 'Elevação Lateral', 'series': 4, 'reps': '10-15' }, { 'exercicio': 'Tríceps Corda', 'series': 3, 'reps': '10-15' }],
    "Pull A (Costas/Bíceps)": [{ 'exercicio': 'Puxada Alta', 'series': 4, 'reps': '8-12' }, { 'exercicio': 'Remada Curvada', 'series': 3, 'reps': '6-10' }, { 'exercicio': 'Remada Baixa', 'series': 3, 'reps': '8-12' }, { 'exercicio': 'Face Pull', 'series': 3, 'reps': '12-15' }, { 'exercicio': 'Rosca Direta', 'series': 3, 'reps': '8-12' }],
    "Legs A (Pernas)": [{ 'exercicio': 'Agachamento Livre', 'series': 4, 'reps': '6-10' }, { 'exercicio': 'Leg Press 45°', 'series': 3, 'reps': '8-12' }, { 'exercicio': 'Cadeira Extensora', 'series': 3, 'reps': '10-15' }, { 'exercicio': 'Stiff', 'series': 3, 'reps': '8-12' }, { 'exercicio': 'Panturrilha em Pé', 'series': 4, 'reps': '10-15' }],
    "Push B (Ombro/Peito)": [{ 'exercicio': 'Desenvolvimento Halteres', 'series': 4, 'reps': '6-10' }, { 'exercicio': 'Supino Inclinado', 'series': 3, 'reps': '8-12' }, { 'exercicio': 'Voador (Peck Deck)', 'series': 3, 'reps': '10-15' }, { 'exercicio': 'Elevação Lateral Polia', 'series': 4, 'reps': '12-15' }, { 'exercicio': 'Tríceps Testa', 'series': 3, 'reps': '8-12' }],
    "Pull B (Costas/Bíceps)": [{ 'exercicio': 'Remada Cavalinho', 'series': 4, 'reps': '6-10' }, { 'exercicio': 'Puxada Supinada', 'series': 3, 'reps': '8-12' }, { 'exercicio': 'Remada Serrote', 'series': 3, 'reps': '8-12' }, { 'exercicio': 'Rosca Scott', 'series': 3, 'reps': '8-12' }],
    "Legs B (Pernas)": [{ 'exercicio': 'Levantamento Terra', 'series': 4, 'reps': '5-8' }, { 'exercicio': 'Cadeira Flexora', 'series': 3, 'reps': '10-15' }, { 'exercicio': 'Agachamento Búlgaro', 'series': 3, 'reps': '8-12' }, { 'exercicio': 'Panturrilha Sentado', 'series': 4, 'reps': '12-20' }]
};
const DEFAULT_METAS_NUTRICIONAIS = { "calorias": 3000, "proteinas": 160, "carboidratos": 400, "gorduras": 80 };
// Chave da API Gemini (Vite)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// --- FUNÇÕES UTILITÁRIAS ---
const getTodayDateString = () => new Date().toISOString().split('T')[0];

// --- COMPONENTES DA UI ---
function NavButton({ icon, label, onClick, isActive }) {
    const activeClass = isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white';
    return <button onClick={onClick} className={`nav-btn flex-1 text-center py-3 px-2 rounded-lg transition-colors duration-200 ${activeClass}`}><i className={`fas ${icon} mr-1`}></i> {label}</button>;
}

function Notification({ message, isError, visible }) {
    const bgColor = isError ? 'bg-red-500' : 'bg-green-500';
    const transform = visible ? 'translate-x-0' : 'translate-x-full';
    return <div className={`fixed bottom-4 right-4 text-white py-3 px-5 rounded-lg shadow-xl transition-transform duration-500 ${bgColor} ${transform}`}><span>{message}</span></div>;
}

function LoadingSpinner() {
    return <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>;
}

// --- PÁGINA DE LOGIN ---
function LoginComponent({ showNotification }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            showNotification("Por favor, preencha e-mail e senha.", true);
            return;
        }
        setIsLoading(true);
        try {
            if (isSigningUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                showNotification("Conta criada com sucesso!");
                // O onAuthStateChanged tratará de criar o perfil default
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                showNotification("Login efetuado!");
            }
        } catch (error) {
            console.error("Erro de autenticação:", error);
            showNotification(error.message, true);
        }
        setIsLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md fade-in">
                <h2 className="text-3xl font-bold text-center text-blue-400 mb-6">{isSigningUp ? "Criar Conta" : "Login"}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-200 flex items-center justify-center disabled:opacity-50">
                        {isLoading ? <LoadingSpinner /> : (isSigningUp ? "Registar" : "Entrar")}
                    </button>
                    <button type="button" onClick={() => setIsSigningUp(!isSigningUp)} className="w-full text-center text-sm text-gray-400 hover:text-white">
                        {isSigningUp ? "Já tem conta? Faça login." : "Não tem conta? Crie uma."}
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- COMPONENTE PRINCIPAL DA APLICAÇÃO ---
function AppDiario({ user, showNotification }) {
    const [currentView, setCurrentView] = useState('treino');
    const [workoutLog, setWorkoutLog] = useState([]);
    const [nutritionLog, setNutritionLog] = useState([]);

    // Novo estado para o perfil do utilizador (plano e metas)
    const [userProfile, setUserProfile] = useState(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);

    const userId = user.uid;

    // Efeito para carregar TUDO (logs e perfil)
    useEffect(() => {
        if (!userId) return;

        // 1. Carregar/Criar Perfil do Utilizador (Plano e Metas)
        const profileRef = doc(db, 'users', userId, 'profile', 'settings');
        const unsubProfile = onSnapshot(profileRef, async (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile(docSnap.data());
            } else {
                // Novo utilizador: Criar perfil default
                showNotification("A criar perfil default...");
                const defaultProfile = {
                    workoutPlan: DEFAULT_PLANO_TREINO,
                    nutritionGoals: DEFAULT_METAS_NUTRICIONAIS
                };
                await setDoc(profileRef, defaultProfile);
                setUserProfile(defaultProfile); // Define o estado local
            }
            setIsProfileLoading(false);
        });

        // 2. Ouvinte (snapshot) para log de treinos
        const workoutRef = collection(db, 'users', userId, 'workout_log');
        const qWorkout = query(workoutRef, orderBy("timestamp", "desc"));
        const unsubWorkout = onSnapshot(qWorkout, (snapshot) => {
            setWorkoutLog(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 3. Ouvinte (snapshot) para log de nutrição
        const nutritionRef = collection(db, 'users', userId, 'nutrition_log');
        const qNutrition = query(nutritionRef, orderBy("timestamp", "desc"));
        const unsubNutrition = onSnapshot(qNutrition, (snapshot) => {
            setNutritionLog(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubProfile();
            unsubWorkout();
            unsubNutrition();
        };
    }, [userId]);

    // --- FUNÇÕES DE LÓGICA (FIRESTORE) ---
    const handleAddWorkout = async (newEntries) => {
        try {
            const workoutRef = collection(db, 'users', userId, 'workout_log');
            for (const entry of newEntries) {
                await addDoc(workoutRef, { ...entry, timestamp: Date.now() });
            }
            showNotification("Treino salvo com sucesso!");
        } catch (error) { showNotification("Erro ao salvar treino.", true); }
    };

    const handleAddNutrition = async (newItem) => {
        try {
            const nutritionRef = collection(db, 'users', userId, 'nutrition_log');
            await addDoc(nutritionRef, { ...newItem, timestamp: Date.now() });
            showNotification("Alimento adicionado!");
        } catch (error) { showNotification("Erro ao adicionar alimento.", true); }
    };

    const handleRemoveNutrition = async (docId) => {
        try {
            const docRef = doc(db, 'users', userId, 'nutrition_log', docId);
            await deleteDoc(docRef);
            showNotification("Alimento removido.", true);
        } catch (error) { showNotification("Erro ao remover alimento.", true); }
    };

    // NOVA FUNÇÃO: Salvar o perfil (plano e metas)
    const handleUpdateProfile = async (newProfileData) => {
        try {
            const profileRef = doc(db, 'users', userId, 'profile', 'settings');
            await setDoc(profileRef, newProfileData);
            showNotification("Ajustes salvos com sucesso!");
            setCurrentView('plano'); // Manda para o plano para ver as mudanças
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            showNotification("Erro ao salvar ajustes.", true);
        }
    };

    // --- RENDERIZAÇÃO ---
    if (isProfileLoading) {
        return (
            <div className="bg-gray-900 text-gray-200 min-h-screen flex items-center justify-center">
                <h1 className="text-2xl text-blue-400">A carregar perfil...</h1>
            </div>
        );
    }

    const renderActiveView = () => {
        switch (currentView) {
            case 'treino':
                return <ViewRegTreino 
                            plano={userProfile.workoutPlan} 
                            onSaveWorkout={handleAddWorkout} 
                            showNotification={showNotification} 
                        />;
            case 'nutri':
                return <ViewRegNutri 
                            metas={userProfile.nutritionGoals}
                            nutritionLog={nutritionLog} 
                            onAddNutrition={handleAddNutrition}
                            onRemoveNutrition={handleRemoveNutrition}
                            showNotification={showNotification} 
                        />;
            case 'plano':
                return <ViewPlano 
                            plano={userProfile.workoutPlan} 
                        />;
            case 'historico':
                return <ViewHistorico 
                            workoutLog={workoutLog} 
                            nutritionLog={nutritionLog} 
                        />;
            case 'ajustes':
                return <ViewAjustes
                            profile={userProfile}
                            onSave={handleUpdateProfile}
                            showNotification={showNotification}
                        />;
            default:
                return <ViewRegTreino plano={userProfile.workoutPlan} onSaveWorkout={handleAddWorkout} showNotification={showNotification} />;
        }
    };

    return (
        <div className="container mx-auto max-w-lg p-4 min-h-screen">
            <header className="flex justify-between items-center my-6">
                <div>
                    <h1 className="text-3xl font-bold text-blue-400">Diário de Treino</h1>
                    <p className="text-gray-400 text-sm">{user.email}</p>
                </div>
                <button onClick={() => signOut(auth)} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg">Sair</button>
            </header>

            <nav className="grid grid-cols-5 gap-1 bg-gray-800 rounded-lg p-2 mb-6 shadow-lg">
                <NavButton icon="fa-dumbbell" label="Treino" onClick={() => setCurrentView('treino')} isActive={currentView === 'treino'} />
                <NavButton icon="fa-apple-alt" label="Nutrição" onClick={() => setCurrentView('nutri')} isActive={currentView === 'nutri'} />
                <NavButton icon="fa-clipboard-list" label="Plano" onClick={() => setCurrentView('plano')} isActive={currentView === 'plano'} />
                <NavButton icon="fa-history" label="Histórico" onClick={() => setCurrentView('historico')} isActive={currentView === 'historico'} />
                <NavButton icon="fa-cog" label="Ajustes" onClick={() => setCurrentView('ajustes')} isActive={currentView === 'ajustes'} />
            </nav>

            <main>
                {renderActiveView()}
            </main>
        </div>
    );
}

// --- VISUALIZAÇÕES (COMPONENTES DAS PÁGINAS) ---

// (Os componentes antigos foram adaptados para receber 'plano' e 'metas' como props)

function ViewPlano({ plano }) {
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl fade-in">
            <h2 className="text-2xl font-semibold mb-4 text-center">Meu Plano de Treino</h2>
            <div className="space-y-6">
                {Object.entries(plano).map(([dia, exercicios]) => (
                    <div key={dia} className="bg-gray-700 p-4 rounded-lg">
                        <h3 className="text-xl font-semibold text-blue-300 mb-3">{dia}</h3>
                        <ul className="space-y-2">
                            {exercicios.map((ex, index) => (
                                <li key={index} className="flex justify-between items-center text-gray-300">
                                    <span>{ex.exercicio}</span>
                                    <span className="text-gray-400 text-sm">{ex.series}s x {ex.reps}r</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ViewRegNutri({ metas, nutritionLog, onAddNutrition, onRemoveNutrition, showNotification }) {
    const [formData, setFormData] = useState({ alimento: '', proteina: '', carbs: '', gordura: '' });
    const todayDate = getTodayDateString();

    const todaySummary = useMemo(() => {
        const items = nutritionLog.filter(item => item.data === todayDate);
        const totals = items.reduce((acc, item) => {
            acc.proteinas += item.proteina;
            acc.carboidratos += item.carbs;
            acc.gorduras += item.gordura;
            acc.calorias += item.calorias;
            return acc;
        }, { proteinas: 0, carboidratos: 0, gorduras: 0, calorias: 0 });
        return { items, totals };
    }, [nutritionLog, todayDate]);

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        const { alimento } = formData;
        const proteina = parseFloat(formData.proteina) || 0;
        const carbs = parseFloat(formData.carbs) || 0;
        const gordura = parseFloat(formData.gordura) || 0;

        if (!alimento || (proteina === 0 && carbs === 0 && gordura === 0)) {
            showNotification("Preencha o nome do alimento e pelo menos um macro.", true);
            return;
        }

        onAddNutrition({
            data: todayDate,
            alimento,
            proteina,
            carbs,
            gordura,
            calorias: (proteina * 4) + (carbs * 4) + (gordura * 9)
        });
        setFormData({ alimento: '', proteina: '', carbs: '', gordura: '' });
    };

    return (
        <div className="fade-in space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold mb-4 text-center">Minhas Metas Diárias</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div><div className="text-2xl font-bold text-blue-300">{metas.calorias}</div><div className="text-sm text-gray-400">Kcal</div></div>
                    <div><div className="text-2xl font-bold text-green-300">{metas.proteinas}g</div><div className="text-sm text-gray-400">Proteínas</div></div>
                    <div><div className="text-2xl font-bold text-yellow-300">{metas.carboidratos}g</div><div className="text-sm text-gray-400">Carbs</div></div>
                    <div><div className="text-2xl font-bold text-red-300">{metas.gorduras}g</div><div className="text-sm text-gray-400">Gorduras</div></div>
                </div>
            </div>
            {/* ... (Restante do formulário de submissão e resumo do dia) ... */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold mb-4 text-center">Registar Alimento</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" name="alimento" value={formData.alimento} onChange={handleChange} placeholder="Alimento" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                    <div className="grid grid-cols-3 gap-4">
                        <input type="number" step="0.1" name="proteina" value={formData.proteina} onChange={handleChange} placeholder="Proteína (g)" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="number" step="0.1" name="carbs" value={formData.carbs} onChange={handleChange} placeholder="Carbs (g)" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="number" step="0.1" name="gordura" value={formData.gordura} onChange={handleChange} placeholder="Gordura (g)" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-200">
                        <i className="fas fa-plus mr-2"></i> Adicionar Alimento
                    </button>
                </form>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold mb-4 text-center">Resumo de Hoje</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div><div className="text-2xl font-bold text-blue-300">{todaySummary.totals.calorias.toFixed(0)}</div><div className="text-sm text-gray-400">Kcal</div></div>
                    {/* ... (outros totais) ... */}
                    <div><div className="text-2xl font-bold text-red-300">{todaySummary.totals.gorduras.toFixed(0)}g</div><div className="text-sm text-gray-400">Gorduras</div></div>
                </div>
                <div className="mt-6 space-y-2">
                    {todaySummary.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center bg-gray-700 p-2 rounded-lg">
                            <div><span className="font-semibold">{item.alimento}</span> <span className="text-sm text-gray-400"> ({item.calorias.toFixed(0)} kcal)</span></div>
                            <button onClick={() => onRemoveNutrition(item.id)} className="text-red-400 hover:text-red-300 text-xl px-2">&times;</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ViewRegTreino({ plano, onSaveWorkout, showNotification }) {
    const [selectedWorkout, setSelectedWorkout] = useState('');
    const [formData, setFormData] = useState({});

    const handleWorkoutSelect = (e) => {
        setSelectedWorkout(e.target.value);
        setFormData({});
    };

    const handleSeriesChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedWorkout) {
            showNotification("Por favor, selecione um treino.", true);
            return;
        }

        const todayDate = getTodayDateString();
        const exercicios = plano[selectedWorkout];
        let newEntries = [];

        exercicios.forEach((ex, exIndex) => {
            for (let i = 0; i < ex.series; i++) {
                const peso = parseFloat(formData[`ex-${exIndex}-serie-${i}-peso`]) || 0;
                const reps = parseFloat(formData[`ex-${exIndex}-serie-${i}-reps`]) || 0;
                if (peso > 0 && reps > 0) {
                    newEntries.push({ data: todayDate, diaTreino: selectedWorkout, exercicio: ex.exercicio, serie: i + 1, peso: peso, reps: reps });
                }
            }
        });

        if (newEntries.length === 0) { showNotification("Nenhuma série preenchida.", true); return; }
        onSaveWorkout(newEntries);
        setFormData({});
        setSelectedWorkout('');
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl fade-in">
            <h2 className="text-2xl font-semibold mb-4 text-center">Registar Treino de Hoje</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <select value={selectedWorkout} onChange={handleWorkoutSelect} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Selecione o treino --</option>
                    {Object.keys(plano).map(dia => (<option key={dia} value={dia}>{dia}</option>))}
                </select>
                <div className="space-y-4">
                    {selectedWorkout && plano[selectedWorkout].map((ex, exIndex) => (
                        <div key={ex.exercicio} className="bg-gray-700 p-4 rounded-lg">
                            <h4 className="text-lg font-semibold text-gray-200">{ex.exercicio}</h4>
                            <p className="text-sm text-gray-400 mb-2">Meta: {ex.series} séries x {ex.reps} reps</p>
                            <div className="space-y-2">
                                {Array(Number(ex.series)).fill(0).map((_, i) => (
                                    <div key={i} className="grid grid-cols-2 gap-2">
                                        <input type="number" placeholder={`Série ${i+1} - Peso (kg)`} name={`ex-${exIndex}-serie-${i}-peso`} value={formData[`ex-${exIndex}-serie-${i}-peso`] || ''} onChange={handleSeriesChange} className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                        <input type="number" placeholder={`Série ${i+1} - Reps`} name={`ex-${exIndex}-serie-${i}-reps`} value={formData[`ex-${exIndex}-serie-${i}-reps`] || ''} onChange={handleSeriesChange} className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                {selectedWorkout && <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-200"><i className="fas fa-save mr-2"></i> Salvar Treino</button>}
            </form>
        </div>
    );
}

function ViewHistorico({ workoutLog, nutritionLog }) {
    // ... (Este componente não precisa de alterações)
    const formatData = (dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');

    const groupedWorkouts = useMemo(() => {
        const groups = workoutLog.reduce((acc, log) => { (acc[log.data] = acc[log.data] || []).push(log); return acc; }, {});
        Object.keys(groups).forEach(data => {
            const dayLogs = groups[data];
            const nomeTreino = dayLogs.length > 0 ? dayLogs[0].diaTreino : "Treino";
            const exerciciosAgrupados = dayLogs.reduce((acc, log) => { (acc[log.exercicio] = acc[log.exercicio] || []).push(log); return acc; }, {});
            groups[data] = { nomeTreino, exercicios: exerciciosAgrupados };
        });
        return groups;
    }, [workoutLog]);

    const groupedNutrition = useMemo(() => {
        return nutritionLog.reduce((acc, log) => {
            const data = log.data;
            if (!acc[data]) acc[data] = { calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0 };
            acc[data].calorias += log.calorias;
            acc[data].proteinas += log.proteina;
            acc[data].carboidratos += log.carbs;
            acc[data].gorduras += log.gordura;
            return acc;
        }, {});
    }, [nutritionLog]);

    const sortedWorkoutDates = Object.keys(groupedWorkouts).sort((a, b) => new Date(b) - new Date(a));
    const sortedNutritionDates = Object.keys(groupedNutrition).sort((a, b) => new Date(b) - new Date(a));

    return (
        <div className="fade-in space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold mb-4 text-center">Histórico de Treinos</h2>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {sortedWorkoutDates.length === 0 ? (<p className="text-gray-400 text-center">Nenhum treino registado.</p>) : (
                        sortedWorkoutDates.map(data => (
                            <div key={data} className="bg-gray-700 p-4 rounded-lg">
                                <h3 className="text-lg font-semibold text-blue-300">{formatData(data)} - <span className="font-normal">{groupedWorkouts[data].nomeTreino}</span></h3>
                                <ul className="list-disc list-inside space-y-2 mt-2">
                                    {Object.entries(groupedWorkouts[data].exercicios).map(([exercicio, series]) => (
                                        <li key={exercicio} className="ml-4">
                                            <strong className="text-gray-300">{exercicio}:</strong> 
                                            <span className="ml-2 space-x-2">
                                                {series.map(s => (<span key={s.id} className="text-sm bg-gray-600 px-2 py-1 rounded">{s.peso}kg x {s.reps}r</span>))}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
            </div>
            {/* ... (Histórico de Nutrição) ... */}
        </div>
    );
}

// --- NOVO COMPONENTE: AJUSTES (COM IA) ---

// Define o schema exato que a IA deve retornar
const AI_RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        "nutritionGoals": {
            type: "OBJECT",
            properties: {
                "calorias": { type: "NUMBER" },
                "proteinas": { type: "NUMBER" },
                "carboidratos": { type: "NUMBER" },
                "gorduras": { type: "NUMBER" },
            },
            required: ["calorias", "proteinas", "carboidratos", "gorduras"]
        },
        "workoutPlan": {
            type: "ARRAY", // Pedimos um ARRAY (lista)
            description: "Um array de 6 objetos, um para cada dia de treino (PPL A, PPL B).",
            items: { // O que cada item do array deve ter
                type: "OBJECT",
                properties: {
                    "dayName": { 
                        type: "STRING",
                        description: "O nome do dia, ex: 'Push A (Peito/Ombro)'"
                    },
                    "exercises": {
                        type: "ARRAY",
                        description: "A lista de exercícios para esse dia.",
                        items: {
                            type: "OBJECT",
                            properties: {
                                "exercicio": { type: "STRING" },
                                "series": { type: "NUMBER" },
                                "reps": { type: "STRING" }
                            },
                            required: ["exercicio", "series", "reps"]
                        }
                    }
                },
                required: ["dayName", "exercises"]
            }
        }
    },
    required: ["nutritionGoals", "workoutPlan"]
};

function ViewAjustes({ profile, onSave, showNotification }) {
    // O formulário usa o seu próprio estado, inicializado a partir do perfil
    const [formData, setFormData] = useState(profile);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Atualiza o estado do formulário se o perfil mudar (ex: após salvar)
    useEffect(() => {
        setFormData(profile);
    }, [profile]);

    // --- Funções de Edição Manual ---
    const handleGoalChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            nutritionGoals: {
                ...prev.nutritionGoals,
                [name]: Number(value) || 0
            }
        }));
    };

    const handleWorkoutChange = (day, exIndex, field, value) => {
        const updatedExercises = formData.workoutPlan[day].map((ex, i) => 
            i === exIndex ? { ...ex, [field]: (field === 'series' ? Number(value) : value) } : ex
        );
        setFormData(prev => ({
            ...prev,
            workoutPlan: { ...prev.workoutPlan, [day]: updatedExercises }
        }));
    };

    const handleRemoveExercise = (day, exIndex) => {
        const updatedExercises = formData.workoutPlan[day].filter((_, i) => i !== exIndex);
        setFormData(prev => ({
            ...prev,
            workoutPlan: { ...prev.workoutPlan, [day]: updatedExercises }
        }));
    };

    const handleAddExercise = (day) => {
        const newExercise = { exercicio: 'Novo Exercício', series: 3, reps: '8-12' };
        setFormData(prev => ({
            ...prev,
            workoutPlan: { ...prev.workoutPlan, [day]: [...prev.workoutPlan[day], newExercise] }
        }));
    };

    // --- Função de IA ---
    const handleGenerateWithAI = async () => {
        if (!aiPrompt) {
            showNotification("Escreva um prompt para a IA.", true);
            return;
        }
        if (!GEMINI_API_KEY) {
            showNotification("Chave da API Gemini não configurada.", true);
            console.error("VITE_GEMINI_API_KEY não encontrada. Adicione-a ao seu .env.local");
            return;
        }
        
        setIsAiLoading(true);

        const systemPrompt = `Você é um personal trainer e nutricionista de elite. O utilizador irá descrever os seus objetivos. 
        Sua tarefa é gerar um plano de treino (workoutPlan) e metas nutricionais (nutritionGoals) completos.
        O 'workoutPlan' DEVE ser um ARRAY de 6 objetos. Cada objeto deve ter 'dayName' (ex: 'Push A') e 'exercises' (um array de exercícios).
        Siga a divisão PPL de 6 dias (Push A, Pull A, Legs A, Push B, Pull B, Legs B).
        Foque em hipertrofia, com séries entre 3-4 e repetições maioritariamente entre 6-15.
        DEVOLVA APENAS E SÓ O OBJETO JSON no formato exato do schema fornecido.`;

        const payload = {
            contents: [{ parts: [{ text: `Objetivo do utilizador: ${aiPrompt}` }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: AI_RESPONSE_SCHEMA // Usando o novo schema
            }
        };

        try {
            // Endereço da API já corrigido
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error("Erro da API Gemini:", errorBody);
                throw new Error(`Erro da API: ${errorBody.error.message || response.statusText}`);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
                const aiResponse = JSON.parse(result.candidates[0].content.parts[0].text);
                
                // Validamos se a IA devolveu o que pedimos (um objeto nutritionGoals e um array workoutPlan)
                if (aiResponse.nutritionGoals && Array.isArray(aiResponse.workoutPlan)) {
                    
                    // Convertemos o ARRAY 'workoutPlan' num OBJETO
                    // (O formato que o nosso formulário e base de dados esperam)
                    const workoutPlanAsObject = aiResponse.workoutPlan.reduce((acc, day) => {
                        // A IA deve devolver dayName e exercises
                        if(day.dayName && Array.isArray(day.exercises)) {
                           acc[day.dayName] = day.exercises;
                        }
                        return acc;
                    }, {});

                    // Verificação de segurança
                    if (Object.keys(workoutPlanAsObject).length < 6) {
                         showNotification("IA gerou um plano incompleto, mas a carregar...", true);
                         if (Object.keys(workoutPlanAsObject).length === 0) {
                            throw new Error("Formato do workoutPlan da IA está vazio após conversão.");
                         }
                    }

                    // Preenchemos o formulário com os dados convertidos
                    setFormData({
                        nutritionGoals: aiResponse.nutritionGoals,
                        workoutPlan: workoutPlanAsObject
                    });
                    showNotification("Plano gerado pela IA! Verifique e salve.");

                } else {
                    throw new Error("Resposta da IA em formato inesperado (esperava nutritionGoals e um array workoutPlan).");
                }
            } else {
                // Isto pode acontecer se a IA se recusar a responder (filtro de segurança)
                const feedback = result.promptFeedback;
                if (feedback && feedback.blockReason) {
                    throw new Error(`IA bloqueou o prompt: ${feedback.blockReason}`);
                }
                throw new Error("Nenhuma resposta válida da IA.");
            }
        } catch (error) {
            console.error("Erro ao chamar IA:", error);
            showNotification(`Erro ao gerar: ${error.message}`, true);
        }
        setIsAiLoading(false);
    };

    // --- Submissão do Formulário ---
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData); // Salva o estado 'formData' (editado ou da IA)
    };

    return (
        <form onSubmit={handleSubmit} className="fade-in space-y-6">
            {/* Secção da IA */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold mb-4 text-center">Assistente IA</h2>
                <p className="text-gray-400 mb-3 text-sm text-center">Descreva seu objetivo, e a IA preencherá o formulário abaixo para você. (Ex: "Tenho 21 anos, 80kg, quero ganhar massa muscular e focar em peito e ombros")</p>
                <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Descreva seu objetivo aqui..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                />
                <button 
                    type="button" 
                    onClick={handleGenerateWithAI} 
                    disabled={isAiLoading}
                    className="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-200 flex items-center justify-center disabled:opacity-50"
                >
                    {isAiLoading ? <LoadingSpinner /> : <><i className="fas fa-magic mr-2"></i> Gerar Plano com IA</>}
                </button>
            </div>

            {/* Secção Metas Nutricionais */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold mb-4 text-center">Metas Nutricionais</h2>
                <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                        <span className="text-gray-400">Calorias (kcal)</span>
                        <input type="number" name="calorias" value={formData.nutritionGoals.calorias} onChange={handleGoalChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200" />
                    </label>
                    <label className="block">
                        <span className="text-gray-400">Proteínas (g)</span>
                        <input type="number" name="proteinas" value={formData.nutritionGoals.proteinas} onChange={handleGoalChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200" />
                    </label>
                    <label className="block">
                        <span className="text-gray-400">Carboidratos (g)</span>
                        <input type="number" name="carboidratos" value={formData.nutritionGoals.carboidratos} onChange={handleGoalChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200" />
                    </label>
                    <label className="block">
                        <span className="text-gray-400">Gorduras (g)</span>
                        <input type="number" name="gorduras" value={formData.nutritionGoals.gorduras} onChange={handleGoalChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200" />
                    </label>
                </div>
            </div>

            {/* Secção Plano de Treino */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold mb-4 text-center">Plano de Treino (Editável)</h2>
                <div className="space-y-4">
                    {/* Adicionado um fallback caso workoutPlan esteja malformado */}
                    {formData.workoutPlan && Object.keys(formData.workoutPlan).length > 0 ? (
                        Object.keys(formData.workoutPlan).map((day) => (
                            <details key={day} className="bg-gray-700 p-4 rounded-lg open:shadow-lg">
                                <summary className="text-xl font-semibold text-blue-300 cursor-pointer">{day}</summary>
                                <div className="mt-4 space-y-3">
                                    {/* Adicionado um fallback caso o dia esteja malformado */}
                                    {Array.isArray(formData.workoutPlan[day]) && formData.workoutPlan[day].map((ex, exIndex) => (
                                        <div key={exIndex} className="grid grid-cols-8 gap-2 items-center">
                                            <input type="text" placeholder="Exercício" value={ex.exercicio} onChange={(e) => handleWorkoutChange(day, exIndex, 'exercicio', e.target.value)} className="col-span-4 bg-gray-600 p-2 rounded-lg" />
                                            <input type="number" placeholder="Séries" value={ex.series} onChange={(e) => handleWorkoutChange(day, exIndex, 'series', e.target.value)} className="col-span-1 bg-gray-600 p-2 rounded-lg" />
                                            <input type="text" placeholder="Reps" value={ex.reps} onChange={(e) => handleWorkoutChange(day, exIndex, 'reps', e.target.value)} className="col-span-2 bg-gray-600 p-2 rounded-lg" />
                                            <button type="button" onClick={() => handleRemoveExercise(day, exIndex)} className="col-span-1 text-red-500 hover:text-red-400 text-lg">&times; Remover</button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => handleAddExercise(day)} className="w-full text-sm bg-blue-600 hover:bg-blue-700 py-1 rounded-lg">+ Adicionar Exercício</button>
                                </div>
                            </details>
                        ))
                    ) : (
                        <p className="text-gray-400 text-center">Não foi possível carregar o plano de treino. Tente gerar um novo com a IA.</p>
                    )}
                </div>
            </div>

            {/* Botão Salvar */}
            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg shadow-lg transition duration-200 text-lg">
                <i className="fas fa-save mr-2"></i> Salvar Todos os Ajustes
            </button>
        </form>
    );
}

// --- COMPONENTE PAI (Gestor de Auth) ---
export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({ message: '', isError: false, visible: false });

    // Observador do estado de autenticação
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe(); // Limpa o observador
    }, []);

    const showNotification = (message, isError = false) => {
        setNotification({ message, isError, visible: true });
        setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 3000);
    };

    if (loading) {
        return (
            <div className="bg-gray-900 text-gray-200 min-h-screen flex items-center justify-center">
                <h1 className="text-2xl text-blue-400">A carregar...</h1>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 text-gray-200 min-h-screen font-sans">
            {!user ? (
                <LoginComponent showNotification={showNotification} />
            ) : (
                <AppDiario user={user} showNotification={showNotification} />
            )}
            <Notification message={notification.message} isError={notification.isError} visible={notification.visible} />
        </div>
    );
}
