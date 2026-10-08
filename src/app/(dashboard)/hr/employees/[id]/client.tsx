"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Edit, FileText, Download, UserCheck, Trash2, 
  MapPin, Phone, Mail, Building, Briefcase, Calendar, CheckCircle2, XCircle, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection, query } from '@/firebase/firestore-override';

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState('personal');

  const db = useFirestore();
  const { user } = useUser();

  // Fetch from Firebase
  const empDocRef = useMemoFirebase(() => {
    if (!db || !unwrappedParams.id) return null;
    return doc(db, 'employees', unwrappedParams.id);
  }, [db, unwrappedParams.id]);

  const { data: rawEmployee, isLoading } = useDoc(empDocRef);

  // Fetch processing lines to resolve locationId -> name
  const linesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'processing_lines'));
  }, [db, user]);
  const { data: processingLines } = useCollection(linesQuery);

  const checkDiscrepancies = (values: any) => {
    // Determine transport type from selected order (assuming field transportType)
    const selectedOrder = undefined; // Placeholder as original context didn't have orders
    const transport = '';

    const selectedPackaging = { standardWeight: 0 }; // Placeholder
    const standardWeight = selectedPackaging?.standardWeight || 0;

    const issues: any[] = [];

    values.items.forEach((item: any, index: number) => {
      // Expected boxes based on transport and box weight
      let expectedBoxes = 0;
      if (transport.includes('container')) {
        if (standardWeight === 4) expectedBoxes = 240;
        else if (standardWeight === 10) expectedBoxes = 100;
      } else if (transport.includes('truck') || transport.includes('freight')) {
        if (standardWeight === 4) expectedBoxes = 220;
        else if (standardWeight === 10) expectedBoxes = 90;
      }

      if (expectedBoxes && item.numberOfBoxes !== expectedBoxes) {
        issues.push({
          index: index + 1,
          type: 'boxes',
          message: `Expected ${expectedBoxes} boxes for ${standardWeight}kg box, but got ${item.numberOfBoxes}`,
        });
      }

      // Gross weight expectations
      let expectedGross = null;
      if (standardWeight === 4) {
        expectedGross = 4 * expectedBoxes + 78;
      } else if (standardWeight === 10) {
        if (expectedBoxes === 100) expectedGross = 10 * expectedBoxes + 60;
        else if (expectedBoxes === 90) expectedGross = 10 * expectedBoxes + 52;
      }
      if (expectedGross !== null && item.grossWeight < expectedGross) {
        issues.push({
          index: index + 1,
          type: 'gross',
          message: `Gross weight ${item.grossWeight}kg is below expected ${expectedGross}kg`,
        });
      }

      // Net weight expectations
      const expectedNet = standardWeight * expectedBoxes;
      if (expectedNet && item.netWeight < expectedNet) {
        issues.push({
          index: index + 1,
          type: 'net',
          message: `Net weight ${item.netWeight}kg is below expected ${expectedNet}kg`,
        });
      }
    });

    // Existing discrepancy check for packaging weight tolerance (retain)
    const toleranceIssues = values.items.map((item: any, idx: number) => {
      const avgNetWeight = (item.netWeight || 0) / (item.numberOfBoxes || 1);
      if (item.netWeight > 0 && avgNetWeight < standardWeight * 0.95) {
        return {
          index: idx + 1,
          type: 'netTolerance',
          message: `Net weight ${item.netWeight}kg is below 95% of expected ${standardWeight}kg per box`,
        };
      }
      return null;
    }).filter(Boolean);

    return [...issues, ...toleranceIssues];
  };

  const linesMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (processingLines) {
      processingLines.forEach((line: any) => {
        map[line.id] = line.title || line.name || line.lineName || line.id;
      });
    }
    return map;
  }, [processingLines]);

  const employee = React.useMemo(() => {
    if (!rawEmployee) return null;
    return {
      id: rawEmployee.id,
      firstName: rawEmployee.firstName || '',
      lastName: rawEmployee.lastName || '',
      gender: rawEmployee.gender || 'Unknown',
      dateOfBirth: rawEmployee.birthday || '—',
      cin: rawEmployee.cin || '—',
      address: rawEmployee.address || '—',
      familySituation: rawEmployee.familySituation || '—',
      
      photoUrl: rawEmployee.imageUrl || `https://ui-avatars.com/api/?name=${rawEmployee.firstName}+${rawEmployee.lastName}&background=random`,
      position: rawEmployee.position || '—',
      department: rawEmployee.department || '—',
      location: (rawEmployee.locationId && linesMap[rawEmployee.locationId]) || rawEmployee.locationId || '—',
      shift: rawEmployee.shift || '—',
      type: rawEmployee.employeeStatus || 'Fixed CDD', 
      status: rawEmployee.status || 'active',
      
      phone: rawEmployee.phone || '—',
      email: rawEmployee.email || '—',
      joinDate: rawEmployee.joinDate || '—',
      seniority: rawEmployee.seniority || '0%',
      
      netSalary: Number(rawEmployee.salaryNet) || 0,
      grossSalary: Number(rawEmployee.salaryBrut) || 0,
      cnssRegistered: rawEmployee.cnssStatus === 'Declared',
      cnssNumber: rawEmployee.cnssNumber || '—',
      rib: rawEmployee.rib || '—',
      matricule: rawEmployee.matricule || '—',
    };
  }, [rawEmployee, linesMap]);

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 rounded-full border-2 border-[#7a9800] border-t-transparent animate-spin" /></div>;
  }

  if (!employee) {
    return <div className="p-8 text-center text-slate-500">Employee not found.</div>;
  }

    const tabs = [
      { id: 'personal', label: 'Personal Information' },
      { id: 'employment', label: 'Employment Information' },
      { id: 'salary', label: 'Salary Information' },
      { id: 'documents', label: 'Documents' },
    ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-100 to-pink-200 dark:from-gray-800 dark:via-gray-900 dark:to-black p-4 md:p-6 lg:p-8 space-y-6">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/hr/employees')}
          className="text-slate-500 hover:text-slate-800 font-bold -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="h-9 border-slate-200 text-slate-600 bg-white"
            onClick={() => router.push(`/hr/employees/${employee.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" /> Edit Profile
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 md:p-8 border border-white/30 dark:border-gray-600 dark:bg-black/50 shadow-lg flex flex-col md:flex-row items-start md:items-center gap-6 relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-20 -mt-20 z-0"></div>
        
        <div className="z-10 flex-shrink-0">
          <img 
            src={employee.photoUrl} 
            alt={employee.firstName} 
            className="h-28 w-28 md:h-32 md:w-32 rounded-2xl object-cover border-4 border-white shadow-lg"
          />
        </div>
        
        <div className="z-10 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                {employee.firstName} {employee.lastName}
              </h1>
              {employee.status === 'active' 
                ? <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold">ACTIVE</Badge>
                : <Badge variant="secondary" className="font-bold text-slate-500">INACTIVE</Badge>
              }
              <Badge variant="outline" className="border-[#7a9800] text-[#7a9800] font-bold uppercase">{employee.type}</Badge>
            </div>
            
            <p className="text-sm font-semibold text-slate-500 flex items-center gap-2 mb-4">
              <Briefcase size={14} className="text-slate-400" /> {employee.position} &nbsp;&bull;&nbsp; {employee.id}
            </p>
            
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5"><Building size={14} className="text-slate-400" /> {employee.department}</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {employee.location}</span>
              <span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> {employee.phone}</span>
              <span className="flex items-center gap-1.5"><Mail size={14} className="text-slate-400" /> {employee.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content & Tabs */}
      <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-sm border border-white/30 dark:border-gray-600 dark:bg-black/50 overflow-hidden min-h-[500px] flex flex-col">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 pt-4 border-b border-slate-100 overflow-x-auto custom-scrollbar bg-slate-50/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-3 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 rounded-t-lg",
                activeTab === tab.id
                  ? "border-[#7a9800] text-[#7a9800] bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.02)]"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-white/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="p-6 md:p-8 flex-1">
          {activeTab === 'personal' && <PersonalInfoTab data={employee} />}
          {activeTab === 'employment' && <EmploymentInfoTab data={employee} />}
          {activeTab === 'salary' && <SalaryInfoTab data={employee} />}
          {activeTab === 'documents' && <DocumentsTab />}
        </div>
      </div>
    </div>
  );
}

// --- TAB COMPONENTS ---

function PersonalInfoTab({ data }: { data: any }) {
  return (
    <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <InfoGroup label="Full Name" value={`${data.firstName} ${data.lastName}`} />
      <InfoGroup label="Gender" value={data.gender} />
      <InfoGroup label="Date of Birth" value={data.dateOfBirth} />
      <InfoGroup label="CIN (National ID)" value={data.cin} />
      <InfoGroup label="Phone Number" value={data.phone} />
      <InfoGroup label="Email Address" value={data.email || '—'} />
      <div className="md:col-span-2">
        <InfoGroup label="Home Address" value={data.address} />
      </div>
      <InfoGroup label="Family Situation" value={data.familySituation} />
    </div>
  );
}

function EmploymentInfoTab({ data }: { data: any }) {
  return (
    <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <InfoGroup label="Employee ID" value={data.id} />
      <InfoGroup label="Matricule" value={data.matricule} />
      <InfoGroup label="Contract Type" value={data.type === 'fixed' ? 'Fixed Term Contract (CDI)' : 'Seasonal Worker'} />
      <InfoGroup label="Department" value={data.department} />
      <InfoGroup label="Job Position" value={data.position} />
      <InfoGroup label="Location" value={data.location} />
      <InfoGroup label="Work Shift" value={data.shift} />
      <InfoGroup label="Join Date" value={data.joinDate} />
      <InfoGroup label="Seniority" value={data.seniority} />
    </div>
  );
}

function SalaryInfoTab({ data }: { data: any }) {
  return (
    <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="md:col-span-2 grid grid-cols-2 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Net Monthly Salary</label>
          <div className="text-3xl font-black text-slate-800">{data.netSalary.toLocaleString()} <span className="text-sm text-slate-400">MAD</span></div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Gross Salary</label>
          <div className="text-xl font-bold text-slate-600">{data.grossSalary.toLocaleString()} <span className="text-sm text-slate-400">MAD</span></div>
        </div>
      </div>
      
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">CNSS Registration</label>
        <div className="flex items-center gap-2">
          {data.cnssRegistered 
            ? <><CheckCircle2 size={16} className="text-emerald-500" /> <span className="text-sm font-bold text-slate-700">Registered</span></>
            : <><XCircle size={16} className="text-rose-500" /> <span className="text-sm font-bold text-slate-700">Not Registered</span></>
          }
        </div>
      </div>
      <InfoGroup label="CNSS Number" value={data.cnssNumber || '—'} />
      
      <div className="md:col-span-2">
        <InfoGroup label="Bank Account (RIB)" value={data.rib || '—'} />
      </div>
    </div>
  );
}

function DocumentsTab() {
  const docs = [
    { name: 'CIN Copy (Front/Back)', date: '2023-01-15', status: 'verified', type: 'PDF' },
    { name: 'CNSS Registration Certificate', date: '2023-01-20', status: 'verified', type: 'PDF' },
    { name: 'Employment Contract', date: '2023-01-15', status: 'verified', type: 'PDF' },
    { name: 'Medical Fitness Certificate', date: '2024-01-10', status: 'pending', type: 'JPG' },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex justify-end">
        <Button className="bg-[#7a9800] hover:bg-[#6c8500] text-white font-bold h-9">
          Upload Document
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docs.map((doc, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-[#7a9800]/50 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-black text-[10px]">
                {doc.type}
              </div>
              <div>
                <p className="font-bold text-sm text-slate-800">{doc.name}</p>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">Uploaded on {doc.date}</p>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#7a9800]"><Download size={14}/></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500"><Trash2 size={14}/></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderTab({ title, icon, desc }: { title: string, icon: any, desc: string }) {
  return (
    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
      <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-black text-slate-700">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mt-2">{desc}</p>
      <Button variant="outline" className="mt-6 font-bold border-slate-200 text-slate-600">
        Module Configuration Required
      </Button>
    </div>
  );
}

// --- UTILS ---

function InfoGroup({ label, value }: { label: string, value: string | React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
        {label}
      </label>
      <div className="text-sm font-bold text-slate-700 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/50 min-h-[40px] flex items-center">
        {value}
      </div>
    </div>
  );
}
