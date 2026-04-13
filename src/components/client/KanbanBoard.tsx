import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import dayjs from 'dayjs';
import type { Client, ClientStatus } from '@/types/client';
import { STATUS_LABELS, STATUS_COLORS } from '@/constants/status';
import { formatKRW } from '@/utils/formatter';

// --- Types ---

interface KanbanBoardProps {
  clients: Client[];
  onStatusChange: (clientId: string, newStatus: ClientStatus) => void;
}

const COLUMNS: ClientStatus[] = [
  'new',
  'contacted',
  'collecting',
  'drafting',
  'submitted',
  'approved',
];

// Dot color class -> inline border color for column headers
const STATUS_BORDER_HEX: Record<ClientStatus, string> = {
  new: '#3B82F6',
  contacted: '#8B5CF6',
  collecting: '#F59E0B',
  drafting: '#8B5CF6',
  submitted: '#F97316',
  approved: '#10B981',
};

// --- Helpers ---

function toDate(d: Date | { toDate(): Date }): Date {
  if (d instanceof Date) return d;
  if (typeof (d as any).toDate === 'function') return (d as any).toDate();
  return new Date(0);
}

function getDaysSince(d: Date | { toDate(): Date }): number {
  return dayjs().diff(dayjs(toDate(d)), 'day');
}

function totalDebt(client: Client): number {
  return (client.debts || []).reduce((s, d) => s + (d.amount || 0), 0);
}

// --- Sortable Card ---

function SortableCard({
  client,
  isDragOverlay,
}: {
  client: Client;
  isDragOverlay?: boolean;
}) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: client.id });

  const style = isDragOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const days = getDaysSince(client.createdAt);
  const debt = totalDebt(client);

  const dragClass = isDragOverlay
    ? 'shadow-lg opacity-90 ring-2 ring-brand-gold'
    : isDragging
      ? 'opacity-40'
      : '';

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      onClick={(e) => {
        // Prevent navigation when dragging
        if (!isDragging && !isDragOverlay) {
          e.stopPropagation();
          navigate(`/clients/${client.id}`);
        }
      }}
      className={`rounded-lg bg-white border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing select-none ${dragClass}`}
    >
      <p className="font-bold text-sm text-gray-900 truncate">{client.name}</p>
      <p className="text-xs text-brand-gold mt-1">
        채무 {formatKRW(debt)}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">D+{days}</p>
    </div>
  );
}

// --- Droppable Column ---

function KanbanColumn({
  status,
  clients,
}: {
  status: ClientStatus;
  clients: Client[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });

  const ids = useMemo(() => clients.map((c) => c.id), [clients]);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl bg-gray-50 p-3 min-w-[180px] flex flex-col transition-colors ${
        isOver ? 'bg-brand-gold/10' : ''
      }`}
      style={{ borderLeft: `3px solid ${STATUS_BORDER_HEX[status]}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          {STATUS_LABELS[status]}
        </h3>
        <span
          className={`inline-flex items-center justify-center min-w-[22px] h-5 rounded-full px-1.5 text-xs font-bold ${STATUS_COLORS[status].bg} ${STATUS_COLORS[status].text}`}
        >
          {clients.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1 min-h-[60px]">
          {clients.map((client) => (
            <SortableCard key={client.id} client={client} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// --- Main Board ---

export default function KanbanBoard({
  clients,
  onStatusChange,
}: KanbanBoardProps) {
  const [activeClient, setActiveClient] = useState<Client | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const clientsByStatus = useMemo(() => {
    const map: Record<ClientStatus, Client[]> = {
      new: [],
      contacted: [],
      collecting: [],
      drafting: [],
      submitted: [],
      approved: [],
    };
    for (const c of clients) {
      if (c.status in map) map[c.status].push(c);
    }
    return map;
  }, [clients]);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const found = clients.find((c) => c.id === id);
    setActiveClient(found ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveClient(null);
    const { active, over } = event;
    if (!over) return;

    const clientId = String(active.id);
    let newStatus: ClientStatus | null = null;

    const overId = String(over.id);

    // Dropped on a column droppable
    if (overId.startsWith('column-')) {
      newStatus = overId.replace('column-', '') as ClientStatus;
    } else {
      // Dropped on another card - find which column that card belongs to
      const targetClient = clients.find((c) => c.id === overId);
      if (targetClient) {
        newStatus = targetClient.status;
      }
    }

    if (!newStatus) return;

    // Find current status of dragged client
    const draggedClient = clients.find((c) => c.id === clientId);
    if (!draggedClient || draggedClient.status === newStatus) return;

    onStatusChange(clientId, newStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((status) => (
          <div key={status} className="flex-shrink-0 w-[220px]">
            <KanbanColumn
              status={status}
              clients={clientsByStatus[status]}
            />
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeClient ? (
          <div className="w-[220px]">
            <SortableCard client={activeClient} isDragOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
