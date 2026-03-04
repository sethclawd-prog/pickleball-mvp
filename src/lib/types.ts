export type ParticipantStatus = 'confirmed' | 'maybe';

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  code: string;
  starts_at: string;
  note: string | null;
  capacity: number | null;
  venue: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  session_id: string;
  user_id: string;
  status: ParticipantStatus;
  created_at: string;
  updated_at: string;
  user?: Pick<AppUser, 'id' | 'name' | 'phone'> | null;
}

export interface SessionWithParticipants extends Session {
  participants: Participant[];
}

export interface AvailabilityTemplate {
  id: string;
  user_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

export interface StoredIdentity {
  id: string;
  name: string;
  phone: string;
}

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
      };
      sessions: {
        Row: Session;
        Insert: {
          id?: string;
          code: string;
          starts_at: string;
          note?: string | null;
          capacity?: number | null;
          venue?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          starts_at?: string;
          note?: string | null;
          capacity?: number | null;
          venue?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
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
      };
    };
  };
}
