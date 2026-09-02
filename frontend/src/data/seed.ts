import { CONFIG } from "../config.js";
import type { Appointment, Professional, Service } from "../types.js";
import { saveCategories, saveProfessionals, saveServices } from "../services/catalog.js";
import { registerCliente } from "../services/clientes.js";
import { createUsuarioInterno } from "../services/usuarios.js";
import { generateCode } from "../services/booking.js";

const DEFAULT_SERVICES: Service[] = [
  {
    id: "svc-corte",
    name: "Corte Masculino",
    description: "Corte clássico ou moderno, lavado e finalizado com produtos de alta qualidade.",
    category: "cabelo",
    durationMin: 30,
    price: 35,
    icon: "scissors",
    active: true,
  },
  {
    id: "svc-barba",
    name: "Barba Completa",
    description: "Modelagem e acabamento da barba com toalha quente e balm hidratante.",
    category: "barba",
    durationMin: 30,
    price: 25,
    icon: "beard",
    active: true,
  },
  {
    id: "svc-corte-barba",
    name: "Corte + Barba",
    description: "Combo completo de corte e barba com desconto especial.",
    category: "cabelo",
    durationMin: 60,
    price: 55,
    icon: "layers",
    active: true,
  },
  {
    id: "svc-nails",
    name: "Nail Designer",
    description: "Manicure e design de unhas com esmaltação em gel.",
    category: "unhas",
    durationMin: 60,
    price: 40,
    icon: "sparkle",
    active: true,
  },
];

const DEFAULT_PROFESSIONALS: Professional[] = [
  {
    id: "pro-1",
    name: "Rai Colares",
    role: "Barbeiro",
    category: "cabelo",
    active: true,
    email: "profissional@maraca.com",
  },
  {
    id: "pro-2",
    name: "Angelo Souza",
    role: "Recepcionista",
    category: "",
    active: true,
    email: "recepcao@maraca.com",
  },
  {
    id: "pro-3",
    name: "Maria Nails",
    role: "Nail Designer",
    category: "unhas",
    active: true,
    email: "maria@maraca.com",
  },
];

function isoOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function isoOffsetPast(days: number): string {
  return isoOffset(-days);
}

function buildAppointments(): Appointment[] {
  const now = new Date().toISOString();
  const list: Appointment[] = [
    {
      code: generateCode([]),
      clientName: "João Silva",
      phone: "(91) 98888-1111",
      email: "cliente@maraca.com",
      serviceIds: ["svc-corte", "svc-barba"],
      professionalId: "pro-1",
      dateIso: isoOffset(1),
      time: "10:00",
      status: "confirmado",
      createdAt: now,
    },
    {
      code: generateCode([]),
      clientName: "Maria Santos",
      phone: "(91) 98777-2222",
      email: "cliente@maraca.com",
      serviceIds: ["svc-nails"],
      professionalId: "pro-3",
      dateIso: isoOffset(2),
      time: "14:30",
      status: "pendente",
      createdAt: now,
    },
    {
      code: generateCode([]),
      clientName: "João Silva",
      phone: "(91) 98888-1111",
      email: "cliente@maraca.com",
      serviceIds: ["svc-corte"],
      professionalId: "pro-1",
      dateIso: isoOffsetPast(6),
      time: "15:00",
      status: "concluido",
      createdAt: now,
    },
    {
      code: generateCode([]),
      clientName: "Pedro Costa",
      phone: "(91) 98666-3333",
      email: "pedro@maraca.com",
      serviceIds: ["svc-barba"],
      professionalId: "pro-1",
      dateIso: isoOffset(1),
      time: "11:30",
      status: "pendente",
      createdAt: now,
    },
    {
      code: generateCode([]),
      clientName: "Cliente Antigo",
      phone: "(91) 98555-4444",
      email: "cliente@maraca.com",
      serviceIds: ["svc-corte-barba"],
      professionalId: "pro-1",
      dateIso: isoOffsetPast(20),
      time: "09:30",
      status: "cancelado",
      createdAt: now,
    },
  ];
  return list;
}

export function ensureSeed(): void {
  let seeded = false;

  const services = localStorage.getItem(CONFIG.servicesKey);
  if (!services || !JSON.parse(services).length) {
    saveServices(DEFAULT_SERVICES);
    saveCategories(["cabelo", "barba", "unhas"]);
    seeded = true;
  }

  const professionals = localStorage.getItem(CONFIG.professionalsKey);
  if (!professionals || !JSON.parse(professionals).length) {
    saveProfessionals(DEFAULT_PROFESSIONALS);
    seeded = true;
  }

  const appointments = localStorage.getItem(CONFIG.appointmentsKey);
  if (!appointments || !JSON.parse(appointments).length) {
    localStorage.setItem(CONFIG.appointmentsKey, JSON.stringify(buildAppointments()));
    seeded = true;
  }

  const clientes = localStorage.getItem(CONFIG.clientesKey);
  if (!clientes || !JSON.parse(clientes).length) {
    registerCliente({
      nome: "João Silva",
      email: "cliente@maraca.com",
      telefone: "(91) 98888-1111",
      senha: "cliente123",
    });
    seeded = true;
  }

  const usuarios = localStorage.getItem(CONFIG.usuariosKey);
  if (!usuarios || !JSON.parse(usuarios).length) {
    createUsuarioInterno({
      nome: "Angelo Souza",
      email: "recepcao@maraca.com",
      senha: CONFIG.defaultPassword,
      role: "recepcionista",
      professionalId: "pro-2",
    });
    createUsuarioInterno({
      nome: "Rai Colares",
      email: "profissional@maraca.com",
      senha: CONFIG.defaultPassword,
      role: "profissional",
      professionalId: "pro-1",
    });
    seeded = true;
  }

  if (seeded) {
    console.info("[seed] Dados de demonstração criados.");
  }
}
