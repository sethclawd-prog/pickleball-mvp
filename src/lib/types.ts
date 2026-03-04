export type ParticipantStatus = 'confirmed' | 'maybe';

export type AppUser = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
};

export type Session = {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  capacity: number | null;
  court: string | null;
  venue: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Participant = {
  id: string;
  session_id: string;
  user_id: string;
  status: ParticipantStatus;
  created_at: string;
  updated_at: string;
  user?: Pick<AppUser, 'id' | 'name' | 'phone'> | null;
};

export type SessionWithParticipants = Session & {
  participants: Participant[];
};

export type AvailabilityTemplate = {
  id: string;
  user_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
};

export type StoredIdentity = {
  id: string;
  name: string;
  phone: string;
};

export interface Database {
  public: {
    Tables: {
      users: {
        Row: AppUser;
        Insert: {
          id?: string;
          name: string;
          phone: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: Session;
        Insert: {
          id?: string;
          code: string;
          starts_at: string;
          ends_at: string;
          note?: string | null;
          capacity?: number | null;
          court?: string | null;
          venue?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          starts_at?: string;
          ends_at?: string;
          note?: string | null;
          capacity?: number | null;
          court?: string | null;
          venue?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      participants: {
        Row: Omit<Participant, 'user'>;
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          status: ParticipantStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          status?: ParticipantStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'participants_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      availability_templates: {
        Row: AvailabilityTemplate;
        Insert: {
          id?: string;
          user_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          weekday?: number;
          start_time?: string;
          end_time?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_templates_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
