from django.db import models

# Create your models here.

class Propriedade(models.Model):
    codigo = models.CharField(max_length=50, unique=True, db_index=True)
    tipo = models.CharField(max_length=100, db_index=True)
    tipo_imovel = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    endereco = models.TextField()
    cidade = models.CharField(max_length=100, db_index=True)
    estado = models.CharField(max_length=2, db_index=True)
    bairro = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    valor = models.DecimalField(max_digits=12, decimal_places=2, db_index=True)
    valor_avaliacao = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    desconto = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, db_index=True)
    descricao = models.TextField()
    modalidade_venda = models.CharField(max_length=100, null=True, blank=True)
    area = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    area_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    area_privativa = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    area_terreno = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    quartos = models.IntegerField(null=True, blank=True, db_index=True)
    link = models.CharField(max_length=200, null=True, blank=True)
    data_atualizacao = models.DateTimeField(auto_now=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, db_index=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, db_index=True)
    imagem_url = models.URLField(max_length=500, null=True, blank=True)
    imagem_cloudinary_url = models.URLField(max_length=500, null=True, blank=True)
    imagem_cloudinary_id = models.CharField(max_length=100, null=True, blank=True)
    matricula_url = models.URLField(blank=True, null=True, verbose_name='URL da Matrícula')
    analise_matricula = models.TextField(blank=True, null=True, verbose_name='Análise da Matrícula')

    class Meta:
        indexes = [
            models.Index(fields=['estado', 'cidade']),
            models.Index(fields=['estado', 'cidade', 'bairro']),
            models.Index(fields=['tipo_imovel', 'valor']),
            models.Index(fields=['desconto', 'valor']),
        ]
        verbose_name = "Propriedade"
        verbose_name_plural = "Propriedades"

    def __str__(self):
        return f"{self.codigo} - {self.endereco}"

class ImagemPropriedade(models.Model):
    propriedade = models.ForeignKey(Propriedade, on_delete=models.CASCADE, related_name='imagens')
    url = models.URLField()
    ordem = models.IntegerField(default=0)

    def __str__(self):
        return f"Imagem {self.ordem} - {self.propriedade.codigo}"

    class Meta:
        verbose_name = "Imagem da Propriedade"
        verbose_name_plural = "Imagens da Propriedade"
        ordering = ['ordem']
