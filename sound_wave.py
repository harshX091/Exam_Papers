from manim import *

class SoundWaveRoom(Scene):
    def construct(self):
        # 1. Setup the room and person
        room = Rectangle(width=10, height=6, color=WHITE, stroke_width=4)
        
        person_pos = np.array([-2, -1, 0])
        person = Dot(person_pos, color=YELLOW, radius=0.1)
        label = Text("The Clap", font_size=24, color=YELLOW).next_to(person, DOWN)
        
        self.play(Create(room))
        self.play(FadeIn(person), Write(label))
        self.wait(0.5)
        self.play(FadeOut(label))
        
        # 2. Sound wave expanding
        time_tracker = ValueTracker(0)
        self.add(time_tracker)
        
        wave_speed = 4.0
        wave_duration = 3.0
        
        def get_wave(origin, start_time):
            c = Circle(radius=0.1, color=TEAL)
            c.move_to(origin)
            c.set_stroke(opacity=0)
            
            def update_wave(mob):
                t = time_tracker.get_value() - start_time
                if t <= 0 or t > wave_duration:
                    mob.set_stroke(opacity=0)
                else:
                    r = wave_speed * t
                    # Avoid 0 radius 
                    r = max(r, 0.01)
                    new_circle = Circle(radius=r, color=TEAL)
                    new_circle.move_to(origin)
                    opacity = max(0, 1 - (t / wave_duration))
                    new_circle.set_stroke(opacity=opacity, width=6 * opacity)
                    mob.become(new_circle)
                    
            c.add_updater(update_wave)
            return c

        # Primary waves
        num_primary = 3
        primary_interval = 0.2
        for i in range(num_primary):
            self.add(get_wave(person_pos, start_time=i * primary_interval))
            
        # Virtual sources for reflection
        virtual_sources = [
            np.array([-8, -1, 0]),  # Left wall reflection
            np.array([12, -1, 0]),  # Right wall reflection
            np.array([-2, -5, 0]),  # Bottom wall reflection
            np.array([-2, 7, 0])    # Top wall reflection
        ]
        
        for v_pos in virtual_sources:
            # The distance the wave travels to hit the wall is half the distance 
            # between the source and the virtual source.
            dist_to_wall = np.linalg.norm((v_pos - person_pos) / 2)
            hit_time = dist_to_wall / wave_speed
            
            for i in range(num_primary):
                self.add(get_wave(v_pos, start_time=hit_time + i * primary_interval))
                
        # To mask the waves so they don't draw outside the room, 
        # ManimCE provides a Intersection/Exclusion or we can just draw thick borders.
        # A simple trick is to draw 4 giant rectangles acting as a mask around the room
        # matching the background color (BLACK)
        
        # Masks
        mask_color = config.background_color
        left_mask = Rectangle(width=10, height=12, color=mask_color, fill_opacity=1).next_to(room, LEFT, buff=0)
        right_mask = Rectangle(width=10, height=12, color=mask_color, fill_opacity=1).next_to(room, RIGHT, buff=0)
        top_mask = Rectangle(width=12, height=10, color=mask_color, fill_opacity=1).next_to(room, UP, buff=0)
        bottom_mask = Rectangle(width=12, height=10, color=mask_color, fill_opacity=1).next_to(room, DOWN, buff=0)
        
        # Bring masks to front
        self.add(left_mask, right_mask, top_mask, bottom_mask)
        # Bring the room outline back to front so it draws over the masks
        self.add(room)
        
        # Animate time linearly
        self.play(time_tracker.animate.set_value(4.0), run_time=4.0, rate_func=linear)
        self.wait(1)
