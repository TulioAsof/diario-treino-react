
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
    orderBy
} from 'firebase/firestore';

// --- CONSTANTES DA APLICAÇÃO (Plano e Metas) ---
const PLANO_DE_TREINO = {
    "Push A (Foco Peito/Ombro)": [
        { 'exercicio': 'Supino Reto (Barra ou Halteres)', 'series': 4, 'reps': '6-10' },
        { 'exercicio': 'Supino Inclinado (Halteres)', 'series': 3, 'reps': '8-12' },
        // ... (O resto do seu plano de treino entra aqui)
        { 'exercicio': 'Elevação Lateral (Halteres)', 'series': 4, 'reps': '10-15' },
        { 'exercicio': 'Tríceps Corda (Polia)', 'series': 3, 'reps': '10-15' }
    ],
    "Pull A (Foco Dorsal/Bíceps)": [
        { 'exercicio': 'Puxada Alta (Polia - Frente)', 'series': 4, 'reps': '8-12' },
        // ...
        { 'exercicio': 'Rosca Martelo (Halteres)', 'series': 3, 'reps': '10-15' }
    ],
    "Legs A (Foco Quadríceps)": [
        { 'exercicio': 'Agachamento Livre (ou Hack Machine)', 'series': 4, 'reps': '6-10' },
        // ...
        { 'exercicio': 'Panturrilha em Pé (Máquina)', 'series': 4, 'reps': '10-15' }
    ],
    "Push B (Foco Ombros/Tríceps)": [
        { 'exercicio': 'Desenvolvimento de Ombros (Halteres)', 'series': 4, 'reps': '6-10' },
        // ...
        { 'exercicio': 'Tríceps Francês Unilateral (Halter)', 'series': 3, 'reps': '10-15' }
    ],
    "Pull B (Foco Espessura/Trapézio)": [
        { 'exercicio': 'Remada Cavalinho (T-Bar)', 'series': 4, 'reps': '6-10' },
        // ...
        { 'exercicio': 'Rosca Inversa (Polia ou Barra)', 'series': 3, 'reps': '10-15' }
    ],
    "Legs B (Foco Posterior/Glúteo)": [
        { 'exercicio': 'Levantamento Terra (ou Stiff)', 'series': 4, 'reps': '5-8' },
        // ...
        { 'exercicio': 'Panturrilha Sentado (Máquina)', 'series': 4, 'reps': '12-20' }
    ]
};
const METAS_NUTRICIONAIS = {
    "calorias": 3200, "proteinas": 160, "carboidratos": 460, "gorduras": 80
};

// --- FUNÇÕES UTILITÁRIAS ---
const getTodayDateString = () => new Date().toISOString().split('T')[0];

// --- COMPONENTES DA UI ---

// Componente: Botão de Navegação
function NavButton({ icon, label, onClick, isActive }) {
    const activeClass = isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white';
    return (
        <button onClick={onClick} className={`nav-btn flex-1 text-center py-3 px-2 rounded-lg transition-colors duration-200 ${activeClass}`}>
            <i className={`fas ${icon} mr-1`}></i> {label}
        </button>
    );
}

// Componente: Notificação
function Notification({ message, isError, visible }) {
    const bgColor = isError ? 'bg-red-500' : 'bg-green-500';
    const transform = visible ? 'translate-x-0' : 'translate-x-full';
    return (
        <div className={`fixed bottom-4 right-4 text-white py-3 px-5 rounded-lg shadow-xl transition-transform duration-500 ${bgColor} ${transform}`}>
            <span>{message}</span>
        </div>
    );
}

// --- PÁGINA DE LOGIN ---
function LoginComponent({ showNotification }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSigningUp, setIsSigningUp] = useState(false); // Alterna entre Login e Registo

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            showNotification("Por favor, preencha e-mail e senha.", true);
            return;
        }

        try {
            if (isSigningUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                showNotification("Conta criada com sucesso!");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                showNotification("Login efetuado!");
            }
        } catch (error) {
            console.error("Erro de autenticação:", error);
            showNotification(error.message, true);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md fade-in">
                <h2 className="text-3xl font-bold text-center text-blue-400 mb-6">
                    {isSigningUp ? "Criar Conta" : "Login"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="E-mail"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Senha"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-200">
                        {isSigningUp ? "Registar" : "Entrar"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsSigningUp(!isSigningUp)}
                        className="w-full text-center text-sm text-gray-400 hover:text-white"
                    >
                        {isSigningUp ? "Já tem conta? Faça login." : "Não tem conta? Crie uma."}
                    </button>
                </form>
            </div>
        </div>
    );
}


// --- COMPONENTE PRINCIPAL DA APLICAÇÃO (O que era o App.jsx antigo) ---
function AppDiario({ user, showNotification }) {
    const [currentView, setCurrentView] = useState('treino');

    // Agora o estado vem do Firestore, não do localStorage
    const [workoutLog, setWorkoutLog] = useState([]);
    const [nutritionLog, setNutritionLog] = useState([]);

    const userId = user.uid; // ID do utilizador logado

    // Efeito para carregar dados do Firestore em tempo real
    useEffect(() => {
        if (!userId) return;

        // Referência à coleção de treinos do utilizador
        const workoutRef = collection(db, 'users', userId, 'workout_log');
        // Ouvinte (snapshot) para treinos
        const unsubWorkout = onSnapshot(workoutRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWorkoutLog(data);
        });

        // Referência à coleção de nutrição do utilizador
        const nutritionRef = collection(db, 'users', userId, 'nutrition_log');
        const qNutrition = query(nutritionRef, orderBy("timestamp", "desc"));

        // Ouvinte (snapshot) para nutrição
        const unsubNutrition = onSnapshot(qNutrition, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNutritionLog(data);
        });

        // Limpa os ouvintes quando o componente é desmontado
        return () => {
            unsubWorkout();
            unsubNutrition();
        };
    }, [userId]);


    // --- FUNÇÕES DE LÓGICA (AGORA COM FIRESTORE) ---

    // Adiciona um registo de treino
    const handleAddWorkout = async (newEntries) => {
        if (!userId) return;
        try {
            const workoutRef = collection(db, 'users', userId, 'workout_log');
            // Usamos um loop para adicionar cada série como um documento separado
            for (const entry of newEntries) {
                await addDoc(workoutRef, { ...entry, timestamp: Date.now() });
            }
            showNotification("Treino salvo com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar treino:", error);
            showNotification("Erro ao salvar treino.", true);
        }
    };

    // Adiciona um item de nutrição
    const handleAddNutrition = async (newItem) => {
        if (!userId) return;
        try {
            const nutritionRef = collection(db, 'users', userId, 'nutrition_log');
            await addDoc(nutritionRef, { ...newItem, timestamp: Date.now() });
            showNotification("Alimento adicionado!");
        } catch (error) {
            console.error("Erro ao adicionar alimento:", error);
            showNotification("Erro ao adicionar alimento.", true);
        }
    };

    // Remove um item de nutrição
    const handleRemoveNutrition = async (docId) => {
        if (!userId) return;
        try {
            const docRef = doc(db, 'users', userId, 'nutrition_log', docId);
            await deleteDoc(docRef);
            showNotification("Alimento removido.", true);
        } catch (error) {
            console.error("Erro ao remover alimento:", error);
            showNotification("Erro ao remover alimento.", true);
        }
    };


    // --- RENDERIZAÇÃO DAS VISUALIZAÇÕES ---

    const renderActiveView = () => {
        switch (currentView) {
            case 'treino':
                return <ViewRegTreino onSaveWorkout={handleAddWorkout} showNotification={showNotification} />;
            case 'nutri':
                return <ViewRegNutri 
                            nutritionLog={nutritionLog} 
                            onAddNutrition={handleAddNutrition}
                            onRemoveNutrition={handleRemoveNutrition}
                            showNotification={showNotification} 
                        />;
            case 'plano':
                return <ViewPlano />;
            case 'historico':
                return <ViewHistorico workoutLog={workoutLog} nutritionLog={nutritionLog} />;
            default:
                return <ViewRegTreino onSaveWorkout={handleAddWorkout} showNotification={showNotification} />;
        }
    };

    return (
        <div className="container mx-auto max-w-lg p-4 min-h-screen">
            <header className="flex justify-between items-center my-6">
                <div>
                    <h1 className="text-3xl font-bold text-blue-400">Diário de Treino</h1>
                    <p className="text-gray-400 text-sm">{user.email}</p>
                </div>
                <button
                    onClick={() => signOut(auth)}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg"
                >
                    Sair
                </button>
            </header>

            <nav className="flex justify-around bg-gray-800 rounded-lg p-2 mb-6 shadow-lg">
                <NavButton icon="fa-dumbbell" label="Treino" onClick={() => setCurrentView('treino')} isActive={currentView === 'treino'} />
                <NavButton icon="fa-apple-alt" label="Nutrição" onClick={() => setCurrentView('nutri')} isActive={currentView === 'nutri'} />
                <NavButton icon="fa-clipboard-list" label="Plano" onClick={() => setCurrentView('plano')} isActive={currentView === 'plano'} />
                <NavButton icon="fa-history" label="Histórico" onClick={() => setCurrentView('historico')} isActive={currentView === 'historico'} />
            </nav>

            <main>
                {renderActiveView()}
            </main>
        </div>
    );
}

// --- VISUALIZAÇÕES (COMPONENTES DAS PÁGINAS) ---
// (Estes são os componentes internos, agora adaptados para passar dados via props)

function ViewPlano() {
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl fade-in">
            <h2 className="text-2xl font-semibold mb-4 text-center">Plano de Treino (PPL A/B)</h2>
            <div className="space-y-6">
                {Object.entries(PLANO_DE_TREINO).map(([dia, exercicios]) => (
                    <div key={dia} className="bg-gray-700 p-4 rounded-lg">
                        <h3 className="text-xl font-semibold text-blue-300 mb-3">{dia}</h3>
                        <ul className="space-y-2">
                            {exercicios.map((ex) => (
                                <li key={ex.exercicio} className="flex justify-between items-center text-gray-300">
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

function ViewRegNutri({ nutritionLog, onAddNutrition, onRemoveNutrition, showNotification }) {
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
                <h2 className="text-2xl font-semibold mb-4 text-center">Metas Diárias</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div><div className="text-2xl font-bold text-blue-300">{METAS_NUTRICIONAIS.calorias}</div><div className="text-sm text-gray-400">Kcal</div></div>
                    <div><div className="text-2xl font-bold text-green-300">{METAS_NUTRICIONAIS.proteinas}g</div><div className="text-sm text-gray-400">Proteínas</div></div>
                    <div><div className="text-2xl font-bold text-yellow-300">{METAS_NUTRICIONAIS.carboidratos}g</div><div className="text-sm text-gray-400">Carbs</div></div>
                    <div><div className="text-2xl font-bold text-red-300">{METAS_NUTRICIONAIS.gorduras}g</div><div className="text-sm text-gray-400">Gorduras</div></div>
                </div>
            </div>
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
                    <div><div className="text-2xl font-bold text-green-300">{todaySummary.totals.proteinas.toFixed(0)}g</div><div className="text-sm text-gray-400">Proteínas</div></div>
                    <div><div className="text-2xl font-bold text-yellow-300">{todaySummary.totals.carboidratos.toFixed(0)}g</div><div className="text-sm text-gray-400">Carbs</div></div>
                    <div><div className="text-2xl font-bold text-red-300">{todaySummary.totals.gorduras.toFixed(0)}g</div><div className="text-sm text-gray-400">Gorduras</div></div>
                </div>
                <div className="mt-6 space-y-2">
                    {todaySummary.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center bg-gray-700 p-2 rounded-lg">
                            <div>
                                <span className="font-semibold">{item.alimento}</span>
                                <span className="text-sm text-gray-400"> ({item.calorias.toFixed(0)} kcal)</span>
                            </div>
                            <button onClick={() => onRemoveNutrition(item.id)} className="text-red-400 hover:text-red-300 text-xl px-2">&times;</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ViewRegTreino({ onSaveWorkout, showNotification }) {
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
        const exercicios = PLANO_DE_TREINO[selectedWorkout];
        let newEntries = [];

        exercicios.forEach((ex, exIndex) => {
            for (let i = 0; i < ex.series; i++) {
                const peso = parseFloat(formData[`ex-${exIndex}-serie-${i}-peso`]) || 0;
                const reps = parseFloat(formData[`ex-${exIndex}-serie-${i}-reps`]) || 0;
                if (peso > 0 && reps > 0) {
                    newEntries.push({
                        data: todayDate,
                        diaTreino: selectedWorkout,
                        exercicio: ex.exercicio,
                        serie: i + 1,
                        peso: peso,
                        reps: reps
                    });
                }
            }
        });

        if (newEntries.length === 0) {
            showNotification("Nenhuma série preenchida.", true);
            return;
        }

        onSaveWorkout(newEntries); // Chama a função do Firestore
        setFormData({});
        setSelectedWorkout('');
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl fade-in">
            <h2 className="text-2xl font-semibold mb-4 text-center">Registar Treino de Hoje</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <select value={selectedWorkout} onChange={handleWorkoutSelect} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Selecione o treino --</option>
                    {Object.keys(PLANO_DE_TREINO).map(dia => (<option key={dia} value={dia}>{dia}</option>))}
                </select>
                <div className="space-y-4">
                    {selectedWorkout && PLANO_DE_TREINO[selectedWorkout].map((ex, exIndex) => (
                        <div key={ex.exercicio} className="bg-gray-700 p-4 rounded-lg">
                            <h4 className="text-lg font-semibold text-gray-200">{ex.exercicio}</h4>
                            <p className="text-sm text-gray-400 mb-2">Meta: {ex.series} séries x {ex.reps} reps</p>
                            <div className="space-y-2">
                                {Array(ex.series).fill(0).map((_, i) => (
                                    <div key={i} className="grid grid-cols-2 gap-2">
                                        <input type="number" placeholder={`Série ${i+1} - Peso (kg)`} name={`ex-${exIndex}-serie-${i}-peso`} value={formData[`ex-${exIndex}-serie-${i}-peso`] || ''} onChange={handleSeriesChange} className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                        <input type="number" placeholder={`Série ${i+1} - Reps`} name={`ex-${exIndex}-serie-${i}-reps`} value={formData[`ex-${exIndex}-serie-${i}-reps`] || ''} onChange={handleSeriesChange} className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                {selectedWorkout && (
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-200">
                        <i className="fas fa-save mr-2"></i> Salvar Treino
                    </button>
                )}
            </form>
        </div>
    );
}

function ViewHistorico({ workoutLog, nutritionLog }) {
    const formatData = (dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');

    const groupedWorkouts = useMemo(() => {
        const groups = workoutLog.reduce((acc, log) => {
            (acc[log.data] = acc[log.data] || []).push(log);
            return acc;
        }, {});
        Object.keys(groups).forEach(data => {
            const dayLogs = groups[data];
            const nomeTreino = dayLogs[0].diaTreino;
            const exerciciosAgrupados = dayLogs.reduce((acc, log) => {
                (acc[log.exercicio] = acc[log.exercicio] || []).push(log);
                return acc;
            }, {});
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
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold mb-4 text-center">Histórico de Nutrição</h2>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {sortedNutritionDates.length === 0 ? (<p className="text-gray-400 text-center">Nenhum registo de nutrição.</p>) : (
                        sortedNutritionDates.map(data => (
                            <div key={data} className="bg-gray-700 p-4 rounded-lg">
                                <h3 className="text-lg font-semibold text-green-300 mb-2">{formatData(data)}</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                    <div><span className="font-bold text-blue-300">{groupedNutrition[data].calorias.toFixed(0)}</span> <span className="text-xs text-gray-400">Kcal</span></div>
                                    <div><span className="font-bold text-green-300">{groupedNutrition[data].proteinas.toFixed(0)}g</span> <span className="text-xs text-gray-400">Prot</span></div>
                                    <div><span className="font-bold text-yellow-300">{groupedNutrition[data].carboidratos.toFixed(0)}g</span> <span className="text-xs text-gray-400">Carb</span></div>
                                    <div><span className="font-bold text-red-300">{groupedNutrition[data].gorduras.toFixed(0)}g</span> <span className="text-xs text-gray-400">Gord</span></div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}


// --- COMPONENTE PAI QUE GERE A AUTENTICAÇÃO ---
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

    // Função para mostrar notificação (passada como prop)
    const showNotification = (message, isError = false) => {
        setNotification({ message, isError, visible: true });
        setTimeout(() => {
            setNotification(prev => ({ ...prev, visible: false }));
        }, 3000);
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

            <Notification 
                message={notification.message} 
                isError={notification.isError} 
                visible={notification.visible} 
            />
        </div>
    );
}
