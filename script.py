from manim import *

class NewtonsCooling(Scene):
    def construct(self):
        # Title
        title = Tex("Newton's Law of Cooling").scale(1.2).to_edge(UP)
        self.play(Write(title))
        self.wait(1)

        # Mathematical Derivation
        eq1 = MathTex(r"\frac{dT}{dt} = -k (T - T_{env})")
        eq2 = MathTex(r"\int \frac{dT}{T - T_{env}} = \int -k \, dt")
        eq3 = MathTex(r"\ln(T - T_{env}) = -kt + C")
        eq4 = MathTex(r"T(t) = T_{env} + (T_0 - T_{env}) e^{-kt}")

        derivation = VGroup(eq1, eq2, eq3, eq4).arrange(DOWN, buff=0.5).scale(0.8)
        derivation.next_to(title, DOWN, buff=0.5)

        for eq in derivation:
            self.play(Write(eq))
            self.wait(1.5)

        self.play(FadeOut(derivation))
        self.wait(0.5)

        # Visual Graph
        axes = Axes(
            x_range=[0, 10, 2],
            y_range=[0, 100, 20],
            x_length=7,
            y_length=5,
            axis_config={"include_numbers": True},
        )
        axes_labels = axes.get_axis_labels(x_label="Time (t)", y_label="Temperature (T)")

        self.play(Create(axes), Write(axes_labels))

        # Parameters
        T_env = 20
        T_0 = 90
        k = 0.5

        # Plot curve
        graph = axes.plot(lambda x: T_env + (T_0 - T_env) * np.exp(-k * x), color=BLUE, x_range=[0, 10])
        
        # Environmental temperature asymptote
        env_line = axes.plot(lambda x: T_env, color=RED, x_range=[0, 10])
        env_label = Tex("$T_{env}$", color=RED).next_to(env_line, RIGHT, buff=0.1)

        self.play(Create(graph))
        self.play(Create(env_line), Write(env_label))
        self.wait(3)

        self.play(
            *[FadeOut(mob)for mob in self.mobjects]
        )
        self.wait(1)
