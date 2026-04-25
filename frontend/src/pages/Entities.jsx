import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Trash2, Plus, Database, Pencil,
    X, User, Building2, MapPin, Lightbulb,
    CheckCircle2, Link2, Info, EyeOff, Eye,
    LayoutGrid, Search, Settings
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Icon mapping for known types
const ICON_MAP = {
    'PERSON': User,
    'ORGANIZATION': Building2,
    'LOCATION': MapPin,
    'CONCEPT': Lightbulb
};

// Spanish names for known types
const NAME_MAP = {
    'PERSON': 'Persona',
    'ORGANIZATION': 'Organización',
    'LOCATION': 'Lugar',
    'CONCEPT': 'Concepto'
};

// Color mapping helper
const getColorClasses = (color) => {
    const colorMap = {
        'blue': { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/8 dark:bg-blue-500/15', border: 'border-blue-200 dark:border-blue-800' },
        'purple': { text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/8 dark:bg-purple-500/15', border: 'border-purple-200 dark:border-purple-800' },
        'green': { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/8 dark:bg-emerald-500/15', border: 'border-emerald-200 dark:border-emerald-800' },
        'cyan': { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/8 dark:bg-cyan-500/15', border: 'border-cyan-200 dark:border-cyan-800' },
        'red': { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/8 dark:bg-red-500/15', border: 'border-red-200 dark:border-red-800' },
        'orange': { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/8 dark:bg-orange-500/15', border: 'border-orange-200 dark:border-orange-800' },
        'yellow': { text: 'text-yellow-500 dark:text-yellow-300', bg: 'bg-yellow-400/10 dark:bg-yellow-400/20', border: 'border-yellow-200/50 dark:border-yellow-800/50' },
        'pink': { text: 'text-pink-500 dark:text-pink-300', bg: 'bg-pink-400/10 dark:bg-pink-400/20', border: 'border-pink-200/50 dark:border-pink-800/50' },
        'indigo': { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/8 dark:bg-indigo-500/15', border: 'border-indigo-200 dark:border-indigo-800' },
    };
    return colorMap[color] || colorMap['blue'];
};

const Entities = () => {
    const { addToast } = useToast();
    const [entities, setEntities] = useState([]);
    const [sources, setSources] = useState([]);
    const [entityTypes, setEntityTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        source_ids: [],
        aliases: ''
    });
    const [typeFormData, setTypeFormData] = useState({
        name: '',
        color: 'blue'
    });
    const [editingTypeId, setEditingTypeId] = useState(null);
    const [activeTab, setActiveTab] = useState('active'); // 'active' or 'ignored'
    const [selectedType, setSelectedType] = useState(null);
    const [selectedLetter, setSelectedLetter] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [entitiesRes, sourcesRes, typesRes] = await Promise.all([
                axios.get('http://localhost:8000/api/entities?include_ignored=true'),
                axios.get('http://localhost:8000/api/sources'),
                axios.get('http://localhost:8000/api/entity-types')
            ]);
            setEntities(entitiesRes.data);
            setSources(sourcesRes.data);
            setEntityTypes(typesRes.data);

            // Set default type to first available type
            if (typesRes.data.length > 0 && !formData.type) {
                setFormData(prev => ({ ...prev, type: typesRes.data[0].name }));
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            addToast('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const resetForm = () => {
        const defaultType = entityTypes.length > 0 ? entityTypes[0].name : '';
        setFormData({ name: '', type: defaultType, source_ids: [], aliases: '' });
        setEditingId(null);
        setIsModalOpen(false);
    };

    const resetTypeForm = () => {
        setTypeFormData({ name: '', color: 'blue' });
        setEditingTypeId(null);
        setIsTypeModalOpen(false);
    };

    const handleCreateType = async (e) => {
        e.preventDefault();
        try {
            if (editingTypeId) {
                await axios.put(`http://localhost:8000/api/entity-types/${editingTypeId}`, typeFormData);
                addToast('Tipo de entidad actualizado correctamente', 'success');
            } else {
                await axios.post('http://localhost:8000/api/entity-types', typeFormData);
                addToast('Tipo de entidad creado correctamente', 'success');
            }
            setTypeFormData({ name: '', color: 'blue' });
            setEditingTypeId(null);
            fetchData();
        } catch (error) {
            console.error('Error saving entity type:', error);
            addToast(error.response?.data?.detail || 'Error al guardar tipo de entidad', 'error');
        }
    };

    const handleDeleteType = async (id) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este tipo? Las entidades asociadas podrían perder su estilo.')) return;
        try {
            await axios.delete(`http://localhost:8000/api/entity-types/${id}`);
            addToast('Tipo de entidad eliminado correctamente', 'success');
            fetchData();
        } catch (error) {
            console.error('Error deleting entity type:', error);
            addToast('Error al eliminar tipo de entidad', 'error');
        }
    };

    const handleEditType = (type) => {
        setTypeFormData({
            name: type.name,
            color: type.color
        });
        setEditingTypeId(type.id);
    };

    const handleEdit = (entity) => {
        setFormData({
            name: entity.name,
            type: entity.type,
            source_ids: entity.sources.map(s => s.id),
            aliases: entity.aliases ? entity.aliases.join(', ') : ''
        });
        setEditingId(entity.id);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const dataToSend = {
                ...formData,
                aliases: formData.aliases.split(',').map(s => s.trim()).filter(s => s.length > 0)
            };

            if (editingId) {
                await axios.put(`http://localhost:8000/api/entities/${editingId}`, dataToSend);
                addToast('Entidad actualizada correctamente', 'success');
            } else {
                await axios.post('http://localhost:8000/api/entities', dataToSend);
                addToast('Entidad creada correctamente', 'success');
            }
            resetForm();
            fetchData();
        } catch (error) {
            console.error('Error saving entity:', error);
            addToast('Error al guardar la entidad', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar esta entidad?')) return;
        try {
            await axios.delete(`http://localhost:8000/api/entities/${id}`);
            addToast('Entidad eliminada correctamente', 'success');
            fetchData();
        } catch (error) {
            console.error('Error deleting entity:', error);
            addToast('Error al eliminar la entidad', 'error');
        }
    };

    const toggleSourceLink = (sourceId) => {
        setFormData(prev => ({
            ...prev,
            source_ids: prev.source_ids.includes(sourceId)
                ? prev.source_ids.filter(id => id !== sourceId)
                : [...prev.source_ids, sourceId]
        }));
    };

    const handleToggleIgnore = async (id) => {
        try {
            await axios.put(`http://localhost:8000/api/entities/${id}/ignore`);
            addToast('Estado de entidad actualizado', 'success');
            fetchData();
        } catch (error) {
            console.error('Error toggling ignore:', error);
            addToast('Error al actualizar entidad', 'error');
        }
    };

    const getTypeDetails = (typeName) => {
        const entityType = entityTypes.find(t => t.name === typeName);
        if (!entityType) return { name: typeName, color: 'blue', icon: Database };

        const colorClasses = getColorClasses(entityType.color);
        const icon = ICON_MAP[entityType.name] || Database;
        const displayName = NAME_MAP[entityType.name] || entityType.name;

        return {
            id: entityType.name,
            name: displayName,
            icon: icon,
            color: colorClasses.text,
            bgColor: colorClasses.bg,
            borderColor: colorClasses.border
        };
    };

    const filteredEntities = useMemo(() => {
        return entities
            .filter(e => activeTab === 'active' ? !e.is_ignored : e.is_ignored)
            .filter(e => {
                if (selectedType && e.type !== selectedType) return false;
                if (selectedLetter && !e.name.toUpperCase().startsWith(selectedLetter)) return false;
                if (searchTerm && !e.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                return true;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [entities, activeTab, selectedType, selectedLetter, searchTerm]);

    return (
        <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-300">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Database className="w-6 h-6 text-indigo-600" />
                        Gestión de Entidades
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Catálogo de identidades rastreadas por el sistema.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus size={20} />
                    Nueva Entidad
                </button>
            </div>

            {/* Filter Tools Row */}
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Tabs */}
                    <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={cn(
                                "px-6 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2",
                                activeTab === 'active'
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                            )}
                        >
                            <Eye size={16} />
                            Activas ({entities.filter(e => !e.is_ignored).length})
                        </button>
                        <button
                            onClick={() => setActiveTab('ignored')}
                            className={cn(
                                "px-6 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2",
                                activeTab === 'ignored'
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                            )}
                        >
                            <EyeOff size={16} />
                            Ignoradas ({entities.filter(e => e.is_ignored).length})
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                        />
                    </div>
                </div>

                {/* Alphabet Filter */}
                <div className="flex flex-wrap justify-center gap-0.5">
                    <button
                        onClick={() => setSelectedLetter(null)}
                        className={cn(
                            "w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                            !selectedLetter ? "bg-indigo-600 text-white shadow-sm" : "bg-white dark:bg-gray-800 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                        title="Ver Todas"
                    >
                        <LayoutGrid size={12} />
                    </button>
                    {ALPHABET.map(letter => (
                        <button
                            key={letter}
                            onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
                            className={cn(
                                "w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-bold transition-all",
                                selectedLetter === letter
                                    ? "bg-indigo-600 text-white shadow-sm scale-110 z-10"
                                    : "bg-white dark:bg-gray-800 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                        >
                            {letter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="space-y-12">
                <div className={cn(
                    "grid grid-cols-1 gap-4",
                    entityTypes.length === 1 && "md:grid-cols-1",
                    entityTypes.length === 2 && "md:grid-cols-2",
                    entityTypes.length === 3 && "md:grid-cols-3",
                    entityTypes.length === 4 && "md:grid-cols-4",
                    entityTypes.length === 5 && "md:grid-cols-5",
                    entityTypes.length === 6 && "md:grid-cols-3",
                    entityTypes.length > 6 && "md:grid-cols-4"
                )}>
                    {entityTypes.map(type => {
                        const typeDetails = getTypeDetails(type.name);
                        const Icon = typeDetails.icon;
                        const isActive = selectedType === type.name;
                        const count = entities.filter(e => e.type === type.name && (activeTab === 'active' ? !e.is_ignored : e.is_ignored)).length;

                        return (
                            <button
                                key={type.name}
                                onClick={() => setSelectedType(isActive ? null : type.name)}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left",
                                    isActive
                                        ? `${typeDetails.borderColor} ${typeDetails.bgColor} shadow-lg`
                                        : "bg-white dark:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                                )}
                            >
                                <div className={cn("p-2 rounded-xl flex items-center gap-2.5 shrink-0", typeDetails.bgColor)}>
                                    <span className={cn("text-lg font-black leading-none", typeDetails.color)}>{count}</span>
                                    <Icon className={typeDetails.color} size={20} />
                                </div>
                                <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{typeDetails.name}</h3>
                            </button>
                        );
                    })}
                </div>

                {/* Entities Grouped Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {loading ? (
                        <div className="col-span-full py-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                            <p className="text-gray-500 dark:text-gray-400">Cargando entidades...</p>
                        </div>
                    ) : filteredEntities.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                            <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sin coincidencias</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">No se encontraron entidades con los filtros aplicados.</p>
                        </div>
                    ) : (
                        filteredEntities.map((entity) => {
                            const typeDetails = getTypeDetails(entity.type);
                            const Icon = typeDetails.icon;
                            return (
                                <div
                                    key={entity.id}
                                    className={cn(
                                        "group bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 p-2.5 hover:shadow-md hover:shadow-indigo-500/5 transition-all relative overflow-hidden flex items-center justify-between gap-3",
                                        entity.is_ignored && "opacity-60"
                                    )}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={cn("p-1.5 rounded-lg shrink-0", typeDetails.bgColor)}>
                                            <Icon className={typeDetails.color} size={14} />
                                        </div>
                                        <div>
                                            <h3 className={cn(
                                                "text-sm font-bold truncate",
                                                entity.is_ignored ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"
                                            )}>
                                                {entity.name}
                                            </h3>
                                            {entity.aliases && entity.aliases.length > 0 && (
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[150px]" title={entity.aliases.join(', ')}>
                                                    Alias: {entity.aliases.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-0.5 shrink-0">
                                        <button
                                            onClick={() => handleToggleIgnore(entity.id)}
                                            className={cn(
                                                "p-1 rounded-md transition-colors",
                                                entity.is_ignored ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-950/40" : "text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                                            )}
                                            title={entity.is_ignored ? 'Restaurar' : 'Ignorar'}
                                        >
                                            {entity.is_ignored ? <Eye size={14} /> : <EyeOff size={14} />}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(entity)}
                                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(entity.id)}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Entity Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingId ? 'Editar Entidad' : 'Nueva Entidad'}
                            </h2>
                            <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-900 dark:text-white"
                                        placeholder="Ej: Elon Musk, OpenAI..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Alias / Variaciones <span className="text-xs font-normal text-gray-500">(separados por comas)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.aliases}
                                        onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-900 dark:text-white"
                                        placeholder="Ej: Musk, CEO de Tesla, Dueño de X..."
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Categoría</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsTypeModalOpen(true)}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 font-medium"
                                        >
                                            <Settings size={14} />
                                            Gestionar Tipos de Entidades
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {entityTypes.map(type => {
                                            const typeDetails = getTypeDetails(type.name);
                                            const Icon = typeDetails.icon;
                                            const isSelected = formData.type === type.name;
                                            return (
                                                <button
                                                    key={type.name}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, type: type.name })}
                                                    className={cn(
                                                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                                                        isSelected
                                                            ? `${typeDetails.borderColor} ${typeDetails.bgColor} shadow-sm`
                                                            : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
                                                    )}
                                                >
                                                    <Icon className={typeDetails.color} size={18} />
                                                    <span className={cn("text-xs font-bold", isSelected ? "text-gray-900 dark:text-white" : "text-gray-500")}>
                                                        {typeDetails.name}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-6 py-2.5 text-gray-500 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all"
                                >
                                    {editingId ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Type Management Modal */}
            {isTypeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gestionar Tipos de Entidades</h2>
                            <button onClick={resetTypeForm} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row h-[500px]">
                            {/* Current Types List */}
                            <div className="w-full md:w-1/2 p-6 border-r border-gray-100 dark:border-gray-700 overflow-y-auto">
                                <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Tipos Existentes</h3>
                                <div className="space-y-2">
                                    {entityTypes.map(type => {
                                        const typeDetails = getTypeDetails(type.name);
                                        return (
                                            <div key={type.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("p-1.5 rounded-lg", typeDetails.bgColor)}>
                                                        <typeDetails.icon className={typeDetails.color} size={14} />
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{type.name}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleEditType(type)}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteType(type.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleCreateType} className="w-full md:w-1/2 p-8 space-y-6">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                                    {editingTypeId ? 'Editar Tipo' : 'Nuevo Tipo'}
                                </h3>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nombre</label>
                                    <input
                                        type="text"
                                        value={typeFormData.name}
                                        onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-900 dark:text-white"
                                        placeholder="Ej: Armamento, Evento..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Color</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'blue', name: 'Azul' },
                                            { id: 'purple', name: 'Púrpura' },
                                            { id: 'green', name: 'Verde' },
                                            { id: 'red', name: 'Rojo' },
                                            { id: 'orange', name: 'Naranja' },
                                            { id: 'yellow', name: 'Amarillo' },
                                            { id: 'pink', name: 'Rosa' },
                                            { id: 'indigo', name: 'Índigo' },
                                            { id: 'cyan', name: 'Turquesa' }
                                        ].map(color => {
                                            const colorClasses = getColorClasses(color.id);
                                            return (
                                                <button
                                                    key={color.id}
                                                    type="button"
                                                    onClick={() => setTypeFormData({ ...typeFormData, color: color.id })}
                                                    className={cn(
                                                        "p-3 rounded-xl border-2 transition-all capitalize text-[10px] font-bold",
                                                        typeFormData.color === color.id
                                                            ? `${colorClasses.border} ${colorClasses.bg} ${colorClasses.text}`
                                                            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                                                    )}
                                                >
                                                    {color.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="pt-6 flex justify-end gap-3">
                                    {editingTypeId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingTypeId(null);
                                                setTypeFormData({ name: '', color: 'blue' });
                                            }}
                                            className="px-4 py-2 text-xs text-gray-500 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                        >
                                            Cancelar Edición
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all text-sm"
                                    >
                                        {editingTypeId ? 'Actualizar' : 'Crear'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Entities;
