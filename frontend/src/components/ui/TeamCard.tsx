import React from 'react';
import { Globe, Mail } from 'lucide-react';

interface TeamMember {
  name: string;
  role: string;
  linkedin?: string;
  email?: string;
}

interface TeamCardProps {
  member: TeamMember;
}

export const TeamCard: React.FC<TeamCardProps> = ({ member }) => {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/9 bg-[rgba(19,19,24,0.72)] p-6 backdrop-blur-20 transition-all duration-220 hover:border-white/14 hover:shadow-md">
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/2 to-transparent opacity-0 transition-opacity duration-220 group-hover:opacity-100" />

      {/* Accent bar */}
      <div className="absolute top-0 left-0 h-1 w-12 bg-gradient-to-r from-[#FF8A4C] to-transparent" />

      <div className="relative z-10">
        {/* Name and Role */}
        <h3 className="text-lg font-600 text-[#fafafa]">{member.name}</h3>
        <p className="mt-1 text-sm font-500 text-[#a1a1aa]">{member.role}</p>

        {/* Links */}
        <div className="mt-4 flex gap-3">
          {member.linkedin && (
            <a
              href={member.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-white/9 bg-white/2 px-3 py-1.5 text-xs font-500 text-[#a1a1aa] transition-colors duration-220 hover:border-[#FF8A4C]/25 hover:bg-[#FF8A4C]/12 hover:text-[#FF8A4C]"
              title="LinkedIn"
            >
              <Globe className="h-4 w-4" />
              Profile
            </a>
          )}
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="flex items-center gap-2 rounded-md border border-white/9 bg-white/2 px-3 py-1.5 text-xs font-500 text-[#a1a1aa] transition-colors duration-220 hover:border-[#FF8A4C]/25 hover:bg-[#FF8A4C]/12 hover:text-[#FF8A4C]"
              title="Email"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

interface TeamGridProps {
  members: TeamMember[];
}

export const TeamGrid: React.FC<TeamGridProps> = ({ members }) => {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => (
        <TeamCard key={member.name} member={member} />
      ))}
    </div>
  );
};

// Example usage in a component:
export const TeamShowcase = () => {
  const team: TeamMember[] = [
    {
      name: 'Chirag Verma',
      role: 'Full-stack, Product Vision',
      linkedin: 'https://linkedin.com/in/vkin/',
      email: 'verma.ch@northeastern.edu',
    },
    {
      name: 'Kashyap Akula',
      role: 'Design & Product',
      linkedin: 'https://linkedin.com/in/kashyap-akula-804937210/',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-800 text-[#fafafa]">Team</h2>
        <p className="mt-2 text-sm text-[#a1a1aa]">
          Built as MS Capstone (IE 7945) at Northeastern University, Spring 2026.
        </p>
      </div>
      <TeamGrid members={team} />
    </div>
  );
};
